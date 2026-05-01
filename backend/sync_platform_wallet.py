import os
import sys
from sqlalchemy.orm import Session
from sqlalchemy import func

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import models, database

def sync_platform_wallet():
    db = database.SessionLocal()
    try:
        # 1. Find the Admin
        admin = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).first()
        if not admin:
            print("Error: No admin user found.")
            return

        print(f"Syncing platform revenue for Admin: {admin.full_name}")

        # 2. Find all completed transactions
        completed_offers = db.query(models.Offer).filter(
            models.Offer.status.in_([models.OfferStatus.COMPLETED, models.OfferStatus.AUTO_COMPLETED])
        ).all()

        total_commission = 0
        transactions_created = 0

        for offer in completed_offers:
            # Calculate commission (0.5%)
            commission = int((offer.offered_price * offer.quantity) * 0.005)
            
            if commission <= 0:
                continue

            # Check for existing tx to avoid double sync
            # Search for just the Sale ID in the description
            search_desc = f"Sale ID: {offer.id}"
            existing_tx = db.query(models.WalletTransaction).filter(
                models.WalletTransaction.user_id == admin.id,
                models.WalletTransaction.transaction_type == "platform_revenue",
                models.WalletTransaction.description.like(f"%{search_desc}%")
            ).first()

            if not existing_tx:
                new_tx = models.WalletTransaction(
                    user_id=admin.id,
                    amount=commission,
                    transaction_type="platform_revenue",
                    description=f"Commission earned from {offer.product.title} (Sale ID: {offer.id}) - Historical Sync"
                )
                db.add(new_tx)
                total_commission += commission
                transactions_created += 1
                print(f"  + Added TK {commission} from Offer ID {offer.id}")

        # 3. Update Admin Wallet Balance
        if total_commission > 0:
            admin.wallet_balance += total_commission
            db.commit()
            print("\nSYNC COMPLETE!")
            print(f"Total revenue recovered: TK {total_commission}")
            print(f"New Balance: TK {admin.wallet_balance}")
        else:
            print("\nNo new historical revenue found.")

    except Exception as e:
        db.rollback()
        print(f"Error: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_platform_wallet()
