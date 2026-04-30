import psycopg2
import os

# Database connection parameters
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Add dispute_reason column to offers table
    cur.execute("ALTER TABLE offers ADD COLUMN IF NOT EXISTS dispute_reason VARCHAR;")
    
    conn.commit()
    cur.close()
    conn.close()
    print("Database schema updated successfully.")
except Exception as e:
    print(f"Error updating database: {e}")
