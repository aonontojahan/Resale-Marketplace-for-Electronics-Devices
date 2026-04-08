"""
One-time migration script: adds is_read column to chat_messages table.
Run with: python migrate_is_read.py
"""
import sys
sys.path.insert(0, '.')

from backend.database import engine

SQL = """
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_read INTEGER NOT NULL DEFAULT 0;
"""

with engine.connect() as conn:
    conn.execute(__import__('sqlalchemy').text(SQL))
    conn.commit()
    print("✅ Migration successful: 'is_read' column added to chat_messages.")
