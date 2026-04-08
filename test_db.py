
from backend.models import ListingStatus
from sqlalchemy import Enum
cols = Enum(ListingStatus, values_callable=lambda obj: [e.value for e in obj])
print('Enum mapped values:', cols.enums)

