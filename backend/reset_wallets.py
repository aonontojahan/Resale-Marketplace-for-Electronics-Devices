import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        # 1. Reset balances for all users
        conn.execute(text("UPDATE users SET wallet_balance = 0, escrow_balance = 0"))
        
        # 2. Delete all wallet transactions
        conn.execute(text("DELETE FROM wallet_transactions"))
        
        # 3. Delete all offers (as they hold the transaction state)
        conn.execute(text("DELETE FROM offers"))
        
        # 4. Optional: If you want to reset products to available
        conn.execute(text("UPDATE products SET status = 'APPROVED' WHERE status IN ('sold', 'SOLD')"))
        
        # 5. Optional: Clear chat messages and sessions if you want a complete fresh slate for interactions
        conn.execute(text("DELETE FROM chat_messages"))
        conn.execute(text("DELETE FROM chat_sessions"))
        
        # Commit the transaction
        conn.commit()
        print("Successfully reset all wallet balances, transactions, offers, and chat histories.")
    except Exception as e:
        print(f"Error during reset: {e}")
