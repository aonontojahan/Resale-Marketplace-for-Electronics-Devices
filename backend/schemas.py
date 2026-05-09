from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from .models import UserRole, ProductStatus

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.BUYER
    phone_number: Optional[str] = None
    address_region: Optional[str] = None
    address_city: Optional[str] = None
    address_area: Optional[str] = None
    address_full: Optional[str] = None
    profile_pic_url: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    account_status: str
    suspended_until: Optional[datetime] = None
    listing_banned_until: Optional[datetime] = None

    average_rating: float = 0.0
    total_reviews: int = 0
    wallet_balance: int = 0
    escrow_balance: int = 0

    class Config:
        from_attributes = True

class SignupResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str

class UserActionRequest(BaseModel):
    action: str

class WalletDepositRequest(BaseModel):
    amount: int

class WalletTransactionResponse(BaseModel):
    id: int
    amount: int
    transaction_type: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OfferBase(BaseModel):
    session_id: int
    product_id: str
    offered_price: int
    quantity: int = 1

class OfferCreate(OfferBase):
    pass

class OfferResponse(OfferBase):
    id: int
    buyer_id: int
    seller_id: int
    offered_price: int
    quantity: int = 1
    status: str
    order_number: Optional[int] = None
    created_at: datetime
    
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
    sender_profile_pic: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionBase(BaseModel):
    product_id: str
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
    product_title: Optional[str] = None
    product_price: Optional[str] = None
    product_image_url: Optional[str] = None
    unread_count: int = 0
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True


class WithdrawalRequest(BaseModel):
    amount: int
    method: str  # 'bank', 'bkash', 'nagad'
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    mobile_number: Optional[str] = None


# --- Product Schemas ---

class ProductResponse(BaseModel):
    id: str
    title: str
    category: str
    price: str
    condition: str
    description: str
    image_url: Optional[str] = None           # Legacy / cover photo fallback
    image_urls: List[str] = []                # All uploaded images (ordered; first = cover)
    status: ProductStatus
    inventory_quantity: int
    seller_id: int
    sellerName: Optional[str] = None          # Added for frontend convenience
    sellerEmail: Optional[str] = None
    sellerRating: float = 0.0
    sellerTotalReviews: int = 0
    is_disputed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProductStatusUpdate(BaseModel):
    status: ProductStatus

class PaginatedProductsResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    pages: int
    has_more: bool

class ReviewBase(BaseModel):
    product_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class ReviewResponse(ReviewBase):
    id: int
    reviewer_id: int
    seller_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ReportSummary(BaseModel):
    total_count: int
    total_amount: int
    period: str

class SellerReportItem(BaseModel):
    order_id: int
    order_number: Optional[int] = None
    product_title: str
    price: int
    quantity: int
    commission: int
    net_earnings: int
    status: str
    date: datetime

class SellerReportResponse(BaseModel):
    summary: ReportSummary
    history: List[SellerReportItem]

class BuyerReportItem(BaseModel):
    order_id: int
    order_number: Optional[int] = None
    product_title: str
    price: int
    quantity: int
    status: str
    date: datetime

class BuyerReportResponse(BaseModel):
    summary: ReportSummary
    history: List[BuyerReportItem]

class AdminReportSummary(BaseModel):
    total_users: int
    total_sellers: int
    total_buyers: int
    total_products: int
    total_gtv: int
    total_revenue: int
    active_escrow: int
    period: str

class AdminReportItem(BaseModel):
    order_id: int
    order_number: Optional[int] = None
    product_title: str
    buyer_name: str
    seller_name: str
    total_amount: int
    commission: int
    status: str
    date: datetime

class AdminReportResponse(BaseModel):
    summary: AdminReportSummary
    history: List[AdminReportItem]
