import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'processing'"))
        conn.commit()
        print('Added processing')
    except Exception as e:
        print('Err processing:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'shipped'"))
        conn.commit()
        print('Added shipped')
    except Exception as e:
        print('Err shipped:', e)
