from backend.database import SessionLocal
from backend.models import Product
from sqlalchemy.orm import joinedload

db = SessionLocal()
try:
    products = db.query(Product).options(
        joinedload(Product.seller),
        joinedload(Product.images)
    ).all()
    print(f"Success, found {len(products)} products!")
except Exception as e:
    print(f"Error: {e}")
