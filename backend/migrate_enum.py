import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'delivered'"))
        conn.commit()
        print('Added delivered')
    except Exception as e:
        print('Err delivered:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'completed'"))
        conn.commit()
        print('Added completed')
    except Exception as e:
        print('Err completed:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'auto_completed'"))
        conn.commit()
        print('Added auto_completed')
    except Exception as e:
        print('Err auto_completed:', e)
