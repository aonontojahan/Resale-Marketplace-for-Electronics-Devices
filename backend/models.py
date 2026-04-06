import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SELLER = "seller"
    BUYER = "buyer"

class ListingStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.BUYER, nullable=False)
    
    # Common Fields
    phone_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    dob = Column(DateTime(timezone=True), nullable=True)
    
    # Seller-Specific Verification Fields
    nid_number = Column(String, unique=True, index=True, nullable=True)
    nid_front_path = Column(String, nullable=True)
    nid_back_path = Column(String, nullable=True)
    selfie_path = Column(String, nullable=True)
    wallet_info = Column(String, nullable=True)
    shop_name = Column(String, nullable=True)
    pickup_address = Column(String, nullable=True)
    terms_agreed = Column(Integer, default=0) # 0 for No, 1 for Yes
    
    # Buyer-Specific Fields
    delivery_location = Column(String, nullable=True)
    
    # Store user creation and update time
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
 
    # Disciplinary Actions & Status
    # Status can be: active, banned, pending_verification
    account_status = Column(String, default="active", nullable=False)
    suspended_until = Column(DateTime(timezone=True), nullable=True)
    listing_banned_until = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<User(email='{self.email}', role='{self.role}')>"

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(String, ForeignKey("listings.id"), index=True, nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    listing = relationship("Listing")
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(String, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")
    sender = relationship("User")

class Listing(Base):
    __tablename__ = "listings"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(String, nullable=False)
    condition = Column(String, nullable=False)
    description = Column(String, nullable=False)
    image_url = Column(String, nullable=True) # Relative path to the uploaded image
    status = Column(Enum(ListingStatus), default=ListingStatus.PENDING, nullable=False)
    
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    seller = relationship("User", backref="listings")
