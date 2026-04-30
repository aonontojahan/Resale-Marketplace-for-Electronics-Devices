import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'PROCESSING'"))
        conn.commit()
        print('Added PROCESSING')
    except Exception as e:
        print('Err PROCESSING:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'SHIPPED'"))
        conn.commit()
        print('Added SHIPPED')
    except Exception as e:
        print('Err SHIPPED:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'DELIVERED'"))
        conn.commit()
        print('Added DELIVERED')
    except Exception as e:
        print('Err DELIVERED:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'COMPLETED'"))
        conn.commit()
        print('Added COMPLETED')
    except Exception as e:
        print('Err COMPLETED:', e)
        
    try:
        conn.execute(text("ALTER TYPE offerstatus ADD VALUE 'AUTO_COMPLETED'"))
        conn.commit()
        print('Added AUTO_COMPLETED')
    except Exception as e:
        print('Err AUTO_COMPLETED:', e)
