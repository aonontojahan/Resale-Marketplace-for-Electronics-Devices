import enum
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    SELLER = "seller"
    BUYER = "buyer"

class ProductStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SOLD = "sold"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.BUYER, nullable=False)

    # Common Fields
    phone_number = Column(String, nullable=True)

    # Store user creation and update time
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Disciplinary Actions & Status
    # Status can be: active, banned, pending_verification
    account_status = Column(String, default="active", nullable=False)
    suspended_until = Column(DateTime(timezone=True), nullable=True)
    listing_banned_until = Column(DateTime(timezone=True), nullable=True)

    # Wallet System
    wallet_balance = Column(Integer, default=0, nullable=False)
    escrow_balance = Column(Integer, default=0, nullable=False)

    @property
    def average_rating(self):
        if not self.reviews_received:
            return 0.0
        return sum(r.rating for r in self.reviews_received) / len(self.reviews_received)

    @property
    def total_reviews(self):
        return len(self.reviews_received)

    def __repr__(self):
        return f"<User(email='{self.email}', role='{self.role}')>"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), index=True, nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product", back_populates="chat_sessions")
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    offers = relationship("Offer", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text = Column(String, nullable=False)
    is_read = Column(Integer, default=0, nullable=False)  # 0=false, 1=true

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")
    sender = relationship("User")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(String, nullable=False)
    condition = Column(String, nullable=False)
    description = Column(String, nullable=False)
    image_url = Column(String, nullable=True)  # Legacy cover photo (kept for backward compatibility)
    status = Column(Enum(ProductStatus), default=ProductStatus.PENDING, nullable=False)
    inventory_quantity = Column(Integer, default=1, nullable=False)

    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    seller = relationship("User", backref="products")
    images = relationship("ProductImage", back_populates="product",
                          cascade="all, delete-orphan",
                          order_by="ProductImage.order")
    reviews = relationship("Review", back_populates="product", cascade="all, delete-orphan")
    offers = relationship("Offer", back_populates="product", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="product", cascade="all, delete-orphan")


class ProductImage(Base):
    """Stores multiple images per product (ordered; order=0 is the cover photo)."""
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    image_url = Column(String, nullable=False)   # Relative path: /uploads/...
    order = Column(Integer, default=0, nullable=False)

    product = relationship("Product", back_populates="images")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reviewer = relationship("User", foreign_keys=[reviewer_id])
    seller = relationship("User", foreign_keys=[seller_id], backref="reviews_received")
    product = relationship("Product", back_populates="reviews")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    transaction_type = Column(String, nullable=False) # e.g., 'deposit', 'escrow_hold', 'withdrawal'
    description = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="transactions")

class OfferStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PAID = "paid"
    DISPUTED = "disputed"
    REFUNDED = "refunded"

class Offer(Base):
    __tablename__ = "offers"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    offered_price = Column(Integer, nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    status = Column(Enum(OfferStatus), default=OfferStatus.PENDING, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    session = relationship("ChatSession", back_populates="offers")
    product = relationship("Product", back_populates="offers")
    buyer = relationship("User", foreign_keys=[buyer_id], backref="offers_made")
    seller = relationship("User", foreign_keys=[seller_id], backref="offers_received")
