from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from .models import UserRole, ListingStatus

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.BUYER

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None

class MessageBase(BaseModel):
    text: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    session_id: int
    sender_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionBase(BaseModel):
    listing_id: str
    buyer_id: int
    seller_id: int

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionResponse(ChatSessionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    buyer: UserResponse
    seller: UserResponse
    listing_title: Optional[str] = None
    listing_price: Optional[str] = None
    listing_image_url: Optional[str] = None
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

# --- Listing Schemas ---

class ListingResponse(BaseModel):
    id: str
    title: str
    category: str
    price: str
    condition: str
    description: str
    image_url: Optional[str] = None
    status: ListingStatus
    seller_id: int
    sellerName: Optional[str] = None # Added for frontend convenience
    sellerEmail: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ListingStatusUpdate(BaseModel):
    status: ListingStatus
