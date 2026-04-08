
from backend.main import update_listing_status
from backend.schemas import ListingStatusUpdate
from backend.models import ListingStatus
from backend.database import SessionLocal

db = SessionLocal()
status_update = ListingStatusUpdate(status=ListingStatus.SOLD)
try:
    resp = update_listing_status('listing_b45f33167d', status_update, db)
    print(resp)
except Exception as e:
    import traceback
    traceback.print_exc()

