import os
import asyncio
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Form, File, UploadFile, Query
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import timedelta, datetime, timezone
from typing import List, Dict, Optional

from . import models, schemas, auth, database
from .database import engine, get_db

# Create database tables (if they don't exist)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ReSale Marketplace API")

# OAuth2 scheme — reads 'Authorization: Bearer <token>' header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Ensure uploads directory exists
os.makedirs("backend/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

manager = ConnectionManager()

_app_loop = None

@app.on_event("startup")
def on_startup():
    global _app_loop
    _app_loop = asyncio.get_running_loop()

def push_system_msg(msg: models.ChatMessage, buyer_id: int, seller_id: int):
    global _app_loop
    if not _app_loop: return
    
    msg_dict = {
        "id": msg.id or 0,
        "session_id": msg.session_id,
        "sender_id": msg.sender_id,
        "text": msg.text,
        "created_at": msg.created_at.isoformat() if msg.created_at else datetime.now(timezone.utc).isoformat()
    }
    
    async def _send():
        await manager.send_personal_message(msg_dict, buyer_id)
        if buyer_id != seller_id:
            await manager.send_personal_message(msg_dict, seller_id)
            
    try:
        asyncio.run_coroutine_threadsafe(_send(), _app_loop)
    except Exception:
        pass

# Marketplace Constants
COMMISSION_RATE = 0.005 # 0.5% Escrow Service Fee
DELIVERY_FEE = 150


# ─── UTILITY ──────────────────────────────────────────────────────────────────

def _build_product_response(product: models.Product, seller: models.User) -> schemas.ProductResponse:
    """Helper: convert a Product ORM instance into a ProductResponse schema."""
    resp = schemas.ProductResponse.model_validate(product)
    resp.sellerName = seller.full_name
    resp.sellerEmail = seller.email
    resp.sellerRating = seller.average_rating
    resp.sellerTotalReviews = seller.total_reviews
    # Populate image_urls from the related images table (already ordered)
    resp.image_urls = [img.image_url for img in product.images]
    # Fallback: if no images table yet but legacy image_url exists
    if not resp.image_urls and product.image_url:
        resp.image_urls = [product.image_url]
    
    # Check if there is any active dispute for this product
    from .models import OfferStatus
    disputed_offers = [o for o in product.offers if o.status == OfferStatus.DISPUTED]
    resp.is_disputed = len(disputed_offers) > 0
    
    return resp


# ─── ROOT ─────────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "Welcome to ReSale Marketplace API"}


# ─── AUTH ─────────────────────────────────────────────────────────────────────

@app.post("/auth/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user with minimal fields."""
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    account_status = "pending_verification" if user.role == "seller" else "active"

    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role,
        phone_number=user.phone_number,
        account_status=account_status,
        address_region=user.address_region,
        address_city=user.address_city,
        address_area=user.address_area,
        address_full=user.address_full
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/auth/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if not user or not auth.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.account_status == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been permanently banned.")

    if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is suspended until {user.suspended_until.strftime('%Y-%m-%d %H:%M:%S')}."
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ─── USERS ────────────────────────────────────────────────────────────────────

@app.get("/users/me", response_model=schemas.UserResponse)
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Fetch current user profile from Authorization: Bearer token header."""
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid authentication credentials",
                            headers={"WWW-Authenticate": "Bearer"})

    email = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.account_status == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account has been permanently banned.")

    if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your account is suspended.")
    return user


# ─── WALLET ───────────────────────────────────────────────────────────────────

@app.post("/wallet/deposit", response_model=schemas.UserResponse)
def mock_deposit_funds(
    deposit_req: schemas.WalletDepositRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mock Payment Gateway: Adds funds to user's wallet."""
    if deposit_req.amount <= 0:
        raise HTTPException(status_code=400, detail="Deposit amount must be greater than 0.")
    
    current_user.wallet_balance += deposit_req.amount

    # Create transaction record
    new_tx = models.WalletTransaction(
        user_id=current_user.id,
        amount=deposit_req.amount,
        transaction_type="deposit",
        description="Deposit via SecurePay"
    )
    db.add(new_tx)

    db.commit()
    db.refresh(current_user)
    return current_user

@app.get("/wallet/transactions", response_model=List[schemas.WalletTransactionResponse])
def get_user_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch user's wallet transaction history."""
    return db.query(models.WalletTransaction).filter(
        models.WalletTransaction.user_id == current_user.id
    ).order_by(models.WalletTransaction.created_at.desc()).all()


@app.delete("/wallet/transactions/clear")
def clear_user_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Permanently delete all transaction history for the user."""
    db.query(models.WalletTransaction).filter(
        models.WalletTransaction.user_id == current_user.id
    ).delete()
    db.commit()
    return {"message": "Transaction history cleared successfully."}

# ─── Offers & Negotiation ──────────────────────────────────────────

@app.post("/offers", response_model=schemas.OfferResponse)
def create_offer(
    offer_in: schemas.OfferCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Ensure user is part of the session
    session = db.query(models.ChatSession).filter(models.ChatSession.id == offer_in.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    if current_user.id != session.buyer_id:
        raise HTTPException(status_code=403, detail="Only the buyer can make an offer")
    
    # Create the offer
    new_offer = models.Offer(
        session_id=offer_in.session_id,
        product_id=offer_in.product_id,
        buyer_id=session.buyer_id,
        seller_id=session.seller_id,
        offered_price=offer_in.offered_price,
        quantity=offer_in.quantity,
        status=models.OfferStatus.PENDING
    )
    db.add(new_offer)
    
    # Drop a system message in the chat
    system_msg = models.ChatMessage(
        session_id=offer_in.session_id,
        sender_id=session.buyer_id,
        text=f"📢 OFFER MADE: {current_user.full_name} offered Tk.{offer_in.offered_price:,d} for this item."
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, session.buyer_id, session.seller_id)
    
    # Touch session to float to top of sidebar
    session.updated_at = func.now()
    db.add(session)
    
    db.commit()
    db.refresh(new_offer)
    return new_offer

@app.get("/offers", response_model=List[schemas.OfferResponse])
def get_offers(
    session_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Offer)
    if session_id:
        query = query.filter(models.Offer.session_id == session_id)
    return query.all()

@app.get("/offers/{offer_id}", response_model=schemas.OfferResponse)
def get_offer(offer_id: int, db: Session = Depends(get_db)):
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer

@app.post("/offers/{offer_id}/accept", response_model=schemas.OfferResponse)
def accept_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.seller_id:
        raise HTTPException(status_code=403, detail="Only the seller can accept the offer")
    
    offer.status = models.OfferStatus.ACCEPTED
    
    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=offer.seller_id,
        text=f"✅ OFFER ACCEPTED: {current_user.full_name} has accepted the offer of Tk.{offer.offered_price:,d}!"
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)
    
    # Touch session
    offer.session.updated_at = func.now()
    db.add(offer.session)
    
    db.commit()
    db.refresh(offer)
    return offer

@app.post("/offers/{offer_id}/reject", response_model=schemas.OfferResponse)
def reject_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.seller_id:
        raise HTTPException(status_code=403, detail="Only the seller can reject the offer")
    
    offer.status = models.OfferStatus.REJECTED
    
    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=offer.seller_id,
        text=f"❌ OFFER REJECTED: The seller has declined the offer of Tk.{offer.offered_price:,d}."
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)
    
    # Touch session
    offer.session.updated_at = func.now()
    db.add(offer.session)
    
    db.commit()
    db.refresh(offer)
    return offer

@app.post("/escrow/pay")
def finalize_payment(
    offer_id: int,
    quantity: int = Query(1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer.status != models.OfferStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Offer is not accepted")

    product = db.query(models.Product).filter(models.Product.id == offer.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    total_cost = offer.offered_price * quantity
    final_total = total_cost + DELIVERY_FEE

    if current_user.wallet_balance < final_total:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    # Move funds
    offer.quantity = quantity # Save quantity for later release
    current_user.wallet_balance -= final_total
    # HOLD FULL MONEY (Price + Delivery) in Escrow
    current_user.escrow_balance += final_total 
    
    offer.status = models.OfferStatus.PAID
    
    # Decrement inventory and sync status
    product.inventory_quantity = max(0, product.inventory_quantity - quantity)
    if product.inventory_quantity == 0:
        product.status = models.ProductStatus.SOLD
    
    # Notify chat
    pay_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=offer.buyer_id,
        text=f"💰 PAYMENT COMPLETED: Tk.{final_total:,d} moved to escrow via SecurePay."
    )
    db.add(pay_msg)
    
    # Notify seller explicitly
    seller_notify_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1,
        text=f"📢 ORDER ALERT: The buyer has made the payment. Please prepare the item for delivery and mark it as DELIVERED once shipped."
    )
    db.add(seller_notify_msg)
    db.flush()
    push_system_msg(pay_msg, offer.buyer_id, offer.seller_id)
    push_system_msg(seller_notify_msg, offer.buyer_id, offer.seller_id)
    
    # Add transaction record
    new_tx = models.WalletTransaction(
        user_id=current_user.id,
        amount=-final_total,
        transaction_type="escrow_hold",
        description=f"Escrow payment for {product.title}"
    )
    db.add(new_tx)

    # Touch session
    offer.session.updated_at = func.now()
    db.add(offer.session)

    db.commit()
    return {"message": "Payment successful", "final_total": final_total}

@app.post("/escrow/process/{offer_id}")
def process_order(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Called by the seller to mark the order as PROCESSING (preparing the item).
    """
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.seller_id:
        raise HTTPException(status_code=403, detail="Only the seller can update this order")
    
    if offer.status != models.OfferStatus.PAID:
        raise HTTPException(status_code=400, detail="Invalid transition: Order must be PAID to start processing")

    offer.status = models.OfferStatus.PROCESSING
    
    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1, 
        text="⚙️ ORDER PROCESSING: The seller is now preparing your item for shipment."
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)

    offer.session.updated_at = func.now()
    db.add(offer.session)

    db.commit()
    return {"message": "Order marked as processing", "status": offer.status}

@app.post("/escrow/ship/{offer_id}")
def ship_order(
    offer_id: int,
    tracking_info: str = Query(None, description="Optional tracking info or courier name"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Called by the seller to mark the order as SHIPPED (item dispatched).
    """
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.seller_id:
        raise HTTPException(status_code=403, detail="Only the seller can update this order")
    
    if offer.status != models.OfferStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="Invalid transition: Order must be PROCESSING to be marked as shipped")

    offer.status = models.OfferStatus.SHIPPED
    if tracking_info:
        offer.tracking_info = tracking_info
    
    msg_text = "🚚 ORDER SHIPPED:\n" + (tracking_info if tracking_info else "The item has been handed over to the courier.")
        
    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1, 
        text=msg_text
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)

    offer.session.updated_at = func.now()
    db.add(offer.session)

    db.commit()
    return {"message": "Order marked as shipped", "status": offer.status, "tracking_info": offer.tracking_info}

@app.post("/escrow/deliver/{offer_id}")
def deliver_order(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Called by the seller to mark the order as DELIVERED.
    """
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.seller_id:
        raise HTTPException(status_code=403, detail="Only the seller can mark this order as delivered")
    
    if offer.status != models.OfferStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Invalid transition: Order must be SHIPPED before it can be delivered")

    offer.status = models.OfferStatus.DELIVERED
    
    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1, 
        text="📦 ORDER DELIVERED: The seller has marked the order as delivered. Buyer, please confirm delivery to release funds to the seller. Funds will auto-release in 3 days if no action is taken."
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)

    # Touch session
    offer.session.updated_at = func.now()
    db.add(offer.session)

    db.commit()
    return {"message": "Order marked as delivered", "status": offer.status}

@app.post("/escrow/release/{offer_id}")
def release_payment(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Called by the buyer to release escrowed funds to the seller.
    Deducts the marketplace commission (0.5%).
    """
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.buyer_id:
        raise HTTPException(status_code=403, detail="Only the buyer can release these funds")
    
    if offer.status not in (models.OfferStatus.PAID, models.OfferStatus.PROCESSING, models.OfferStatus.SHIPPED, models.OfferStatus.DELIVERED):
        raise HTTPException(status_code=400, detail="Funds cannot be released at this state")

    # Calculate values
    total_paid = (offer.offered_price * offer.quantity) + DELIVERY_FEE
    
    # Commission is usually on the product price only
    product_price = offer.offered_price * offer.quantity
    commission = int(product_price * COMMISSION_RATE)
    
    # Seller gets: Product Price - Commission + Delivery Fee (assuming seller handles delivery)
    # OR Seller gets: Product Price - Commission, and Platform keeps Delivery Fee.
    # User asked to "hold full money", let's payout the product price - commission to seller.
    # Usually delivery fee is paid back to seller to cover their shipping cost.
    seller_amount = (product_price - commission) + DELIVERY_FEE

    # Move funds
    # 1. Deduct full payment from buyer's escrow
    if current_user.escrow_balance < total_paid:
        raise HTTPException(status_code=400, detail="Insufficient escrow balance")
    
    current_user.escrow_balance -= total_paid
    
    # 2. Add to seller's wallet
    seller = db.query(models.User).filter(models.User.id == offer.seller_id).first()
    seller.wallet_balance += seller_amount
    
    # Update offer status
    offer.status = models.OfferStatus.COMPLETED
    
    # Record transaction for seller
    seller_tx = models.WalletTransaction(
        user_id=seller.id,
        amount=seller_amount,
        transaction_type="sale_payout",
        description=f"Payout for {offer.product.title} (Commission {COMMISSION_RATE*100}% deducted)"
    )
    db.add(seller_tx)

    # Record for Buyer (Escrow release)
    buyer_tx = models.WalletTransaction(
        user_id=current_user.id,
        amount=-total_paid,
        transaction_type="escrow_release",
        description=f"Payment released to seller for {offer.product.title}"
    )
    db.add(buyer_tx)

    # Record platform commission
    admin = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).first()
    if admin and commission > 0:
        admin.wallet_balance += commission
        platform_tx = models.WalletTransaction(
            user_id=admin.id,
            amount=commission,
            transaction_type="platform_revenue",
            description=f"Commission earned from {offer.product.title} (Sale ID: {offer.id})"
        )
        db.add(platform_tx)

    # System message
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1, 
        text=f"✅ FUNDS RELEASED: Tk.{seller_amount:,d} has been moved to the seller's wallet after a {COMMISSION_RATE*100}% service fee."
    )
    db.add(system_msg)

    # Trigger Review Prompt for Buyer (Dynamic Card in Chat)
    review_prompt = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1,
        text=f"[REVIEW_PROMPT]:{offer.product_id}:{offer.product.title}"
    )
    db.add(review_prompt)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)
    push_system_msg(review_prompt, offer.buyer_id, offer.seller_id)

    db.commit()
    return {"message": "Funds released successfully", "seller_received": seller_amount, "commission": commission}

@app.post("/escrow/dispute/{offer_id}")
def dispute_transaction(
    offer_id: int,
    reason: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Called by the buyer if there is an issue with delivery or product.
    Freezes the transaction for admin review.
    """
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if current_user.id != offer.buyer_id:
        raise HTTPException(status_code=403, detail="Only the buyer can raise a dispute")
    
    if offer.status not in (models.OfferStatus.PAID, models.OfferStatus.PROCESSING, models.OfferStatus.SHIPPED, models.OfferStatus.DELIVERED):
        raise HTTPException(status_code=400, detail="Transaction is not in a payable or delivered state")

    offer.status = models.OfferStatus.DISPUTED
    offer.dispute_reason = reason
    
    # Add transaction record for audit trail
    dispute_tx = models.WalletTransaction(
        user_id=current_user.id,
        amount=0, # Money is already in escrow, no balance change but we log the event
        transaction_type="dispute_open",
        description=f"⚠️ DISPUTE RAISED: Case opened for {offer.product.title}"
    )
    db.add(dispute_tx)

    # Notify chat
    msg_text = f"⚠️ DISPUTE RAISED: {reason}" if reason else f"⚠️ DISPUTE RAISED: {current_user.full_name} reported a problem. Funds are locked in Escrow until an Admin reviews the case."
    
    system_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1, 
        text=msg_text
    )
    db.add(system_msg)
    db.flush()
    push_system_msg(system_msg, offer.buyer_id, offer.seller_id)
    
    db.commit()
    return {"message": "Dispute raised successfully. Admin will be notified."}


# ─── ADMIN DISPUTE RESOLUTION ─────────────────────────────────

@app.post("/admin/disputes/{offer_id}/resolve")
def resolve_dispute(
    offer_id: int,
    resolution: str = Query(..., enum=["payout_seller", "refund_full", "refund_partial"]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    ADMIN ONLY: Decides what happens to the locked escrow funds.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can resolve disputes")

    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer or offer.status != models.OfferStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Offer is not in dispute")

    buyer = offer.buyer
    seller = offer.seller
    total_escrow = (offer.offered_price * offer.quantity) + DELIVERY_FEE

    if resolution == "payout_seller":
        # Act like a normal release
        commission = int((offer.offered_price * offer.quantity) * COMMISSION_RATE)
        seller_payout = (offer.offered_price * offer.quantity) - commission + DELIVERY_FEE
        
        buyer.escrow_balance -= total_escrow
        seller.wallet_balance += seller_payout
        offer.status = models.OfferStatus.COMPLETED
        
        msg_text = f"⚖️ ADMIN RESOLUTION: Dispute resolved in favor of SELLER. Tk.{seller_payout:,d} released to seller wallet."

        # Record for Seller
        seller_tx = models.WalletTransaction(
            user_id=seller.id,
            amount=seller_payout,
            transaction_type="sale_payout",
            description=f"⚖️ ADMIN RELEASE: Funds released for {offer.product.title} after dispute."
        )
        # Record for Buyer
        buyer_tx = models.WalletTransaction(
            user_id=buyer.id,
            amount=-total_escrow,
            transaction_type="escrow_release",
            description=f"⚖️ ADMIN RELEASE: Escrow released to seller for {offer.product.title}"
        )
        # Record platform commission
        admin = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).first()
        if admin and commission > 0:
            admin.wallet_balance += commission
            platform_tx = models.WalletTransaction(
                user_id=admin.id,
                amount=commission,
                transaction_type="platform_revenue",
                description=f"⚖️ ADMIN DISPUTE: Commission from {offer.product.title}"
            )
            db.add(platform_tx)

        db.add(seller_tx)
        db.add(buyer_tx)

    elif resolution == "refund_full":
        # Give money back to buyer's wallet (including delivery fee)
        deduct_amount = min(total_escrow, buyer.escrow_balance)
        buyer.escrow_balance -= deduct_amount
        buyer.wallet_balance += total_escrow 
        offer.status = models.OfferStatus.REFUNDED
        
        # Reset product status back to available
        if offer.product:
            offer.product.status = models.ProductStatus.APPROVED
            offer.product.inventory_quantity += offer.quantity
            
        msg_text = f"⚖️ ADMIN RESOLUTION: Dispute resolved with FULL REFUND. Tk.{total_escrow:,d} returned to buyer wallet. Product has been re-listed."

        # Record for Buyer
        refund_tx = models.WalletTransaction(
            user_id=buyer.id,
            amount=total_escrow,
            transaction_type="refund",
            description=f"⚖️ ADMIN REFUND: Full refund for {offer.product.title}"
        )
        db.add(refund_tx)

    else: # refund_partial
        # Refund Product Price to buyer, give Delivery Fee to seller
        product_price_total = (offer.offered_price * offer.quantity)
        
        # Deduct total escrow from frozen
        deduct_amount = min(total_escrow, buyer.escrow_balance)
        buyer.escrow_balance -= deduct_amount
        
        # Split the funds
        buyer.wallet_balance += product_price_total
        seller.wallet_balance += DELIVERY_FEE
        
        offer.status = models.OfferStatus.REFUNDED # Mark as refunded (but it was a split)
        
        # Reset product status back to available
        if offer.product:
            offer.product.status = models.ProductStatus.APPROVED
            offer.product.inventory_quantity += offer.quantity

        msg_text = f"⚖️ ADMIN RESOLUTION: Dispute resolved with PARTIAL REFUND. Tk.{product_price_total:,d} returned to buyer. Tk.{DELIVERY_FEE:,d} released to seller to cover shipping. Product has been re-listed."
        
        # Record for Buyer
        buyer_tx = models.WalletTransaction(
            user_id=buyer.id,
            amount=product_price_total,
            transaction_type="refund",
            description=f"⚖️ ADMIN REFUND: Partial refund for {offer.product.title}"
        )
        # Record for Seller
        seller_tx = models.WalletTransaction(
            user_id=seller.id,
            amount=DELIVERY_FEE,
            transaction_type="shipping_payout",
            description=f"⚖️ ADMIN PAYOUT: Delivery fee released for {offer.product.title}"
        )
        db.add(buyer_tx)
        db.add(seller_tx)

    # Notify chat
    admin_msg = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1,
        text=msg_text
    )
    db.add(admin_msg)

    # Trigger Review Prompt for Buyer (Dynamic Card in Chat - After Dispute)
    review_prompt = models.ChatMessage(
        session_id=offer.session_id,
        sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1,
        text=f"[REVIEW_PROMPT]:{offer.product_id}:{offer.product.title}"
    )
    db.add(review_prompt)
    db.flush()
    push_system_msg(admin_msg, offer.buyer_id, offer.seller_id)
    push_system_msg(review_prompt, offer.buyer_id, offer.seller_id)

    db.commit()

    return {"message": f"Dispute resolved via {resolution}", "status": offer.status}


@app.get("/admin/disputes")
def list_disputes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    ADMIN ONLY: Returns a list of all offers currently in dispute.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can view disputes")

    disputes = db.query(models.Offer).filter(models.Offer.status == models.OfferStatus.DISPUTED).all()
    
    # Enrich with product and user data for the frontend
    results = []
    for d in disputes:
        results.append({
            "id": d.id,
            "product_title": d.product.title,
            "product_price": d.product.price,
            "offered_price": d.offered_price,
            "quantity": d.quantity,
            "buyer_name": d.buyer.full_name,
            "buyer_phone": d.buyer.phone_number,
            "seller_name": d.seller.full_name,
            "seller_phone": d.seller.phone_number,
            "session_id": d.session_id,
            "status": d.status,
            "dispute_reason": d.dispute_reason,
            "product_image": d.product.image_url if d.product.image_url else (d.product.images[0].image_url if d.product.images else "")
        })
    return results


@app.post("/admin/cron/auto-release")
def auto_release_escrow(db: Session = Depends(get_db)):
    """
    Automated job endpoint to release funds for DELIVERED orders 
    that have been waiting for > 3 days.
    (In a real system, this could be triggered by a celery beat or a cron cronjob)
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(days=3)
    
    # Find offers delivered more than 3 days ago
    stale_offers = db.query(models.Offer).filter(
        models.Offer.status == models.OfferStatus.DELIVERED,
        models.Offer.updated_at <= cutoff_time
    ).all()
    
    released_count = 0
    for offer in stale_offers:
        buyer = offer.buyer
        seller = offer.seller
        
        total_paid = (offer.offered_price * offer.quantity) + DELIVERY_FEE
        product_price = offer.offered_price * offer.quantity
        commission = int(product_price * COMMISSION_RATE)
        seller_amount = (product_price - commission) + DELIVERY_FEE
        
        # Move funds
        if buyer.escrow_balance >= total_paid:
            buyer.escrow_balance -= total_paid
            seller.wallet_balance += seller_amount
            
            offer.status = models.OfferStatus.AUTO_COMPLETED
            
            # Record transaction
            seller_tx = models.WalletTransaction(
                user_id=seller.id,
                amount=seller_amount,
                transaction_type="auto_sale_payout",
                description=f"Auto-release Payout for {offer.product.title}"
            )
            db.add(seller_tx)
            
            # Notify chat
            system_msg = models.ChatMessage(
                session_id=offer.session_id,
                sender_id=auth.SYSTEM_USER_ID if hasattr(auth, 'SYSTEM_USER_ID') else 1,
                text=f"⏰ AUTO-RELEASE: 3 days have passed since delivery. Tk.{seller_amount:,d} automatically released to the seller."
            )
            db.add(system_msg)
            db.flush()
            push_system_msg(system_msg, offer.buyer_id, offer.seller_id)
            
            # Touch session
            offer.session.updated_at = func.now()
            db.add(offer.session)
            
            # Record platform commission
            admin = db.query(models.User).filter(models.User.role == models.UserRole.ADMIN).first()
            if admin and commission > 0:
                admin.wallet_balance += commission
                platform_tx = models.WalletTransaction(
                    user_id=admin.id,
                    amount=commission,
                    transaction_type="platform_revenue",
                    description=f"⏰ AUTO-RELEASE: Commission from {offer.product.title}"
                )
                db.add(platform_tx)
            
            released_count += 1
            
    db.commit()
    return {"message": "Auto-release complete", "released_count": released_count}


@app.get("/users", response_model=List[schemas.UserResponse])
def get_users(role: str = None, db: Session = Depends(get_db)):
    """Fetch all users, optionally filtered by role."""
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    return query.all()


# ─── PRODUCTS ─────────────────────────────────────────────────────────────────

@app.post("/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    title: str = Form(...),
    category: str = Form(...),
    price: str = Form(...),
    condition: str = Form(...),
    description: str = Form(...),
    inventory_quantity: int = Form(1),
    images: List[UploadFile] = File(default=[]),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    """Create a new product with optional multiple image uploads (max 5)."""
    print(f"DEBUG /products: received token starts with {token[:10] if token else 'None'}")
    payload = auth.decode_access_token(token)
    if not payload:
        print("DEBUG /products: decode_access_token failed! Invalid token.")
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    print(f"DEBUG /products: user email from token={email}")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        print("DEBUG /products: user not found in DB")
        raise HTTPException(status_code=404, detail="User not found")

    if user.account_status in ("banned", "pending_verification") or \
       (user.suspended_until and user.suspended_until > datetime.now(timezone.utc)):
        detail_msg = ("Your account is pending verification by admin."
                      if user.account_status == "pending_verification"
                      else "Your account is suspended or banned.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail_msg)

    if user.listing_banned_until and user.listing_banned_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are banned from uploading products until "
                   f"{user.listing_banned_until.strftime('%Y-%m-%d %H:%M:%S')}."
        )

    # ── Save up to 5 images ──────────────────────────────────────────────────
    saved_image_urls: List[str] = []
    valid_images = [img for img in images if img and img.filename] if images else []
    valid_images = valid_images[:5]   # Enforce max

    for img_file in valid_images:
        ext = img_file.filename.rsplit(".", 1)[-1].lower()
        file_name = f"{uuid.uuid4().hex}.{ext}"
        file_path = f"backend/uploads/{file_name}"
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(img_file.file, buf)
        saved_image_urls.append(f"/uploads/{file_name}")

    cover_url = saved_image_urls[0] if saved_image_urls else ""
    product_id = f"product_{uuid.uuid4().hex[:10]}"

    new_product = models.Product(
        id=product_id,
        title=title,
        category=category,
        price=price,
        condition=condition,
        description=description,
        inventory_quantity=inventory_quantity,
        image_url=cover_url,      # legacy cover photo field
        seller_id=user.id
    )
    db.add(new_product)
    db.flush()  # Ensure product ID exists before inserting images

    for order_idx, url in enumerate(saved_image_urls):
        db.add(models.ProductImage(
            product_id=product_id,
            image_url=url,
            order=order_idx
        ))

    db.commit()
    db.refresh(new_product)
    return _build_product_response(new_product, user)


@app.get("/products/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    """Fetch a single product by its ID."""
    product = db.query(models.Product).options(
        joinedload(models.Product.seller),
        joinedload(models.Product.images),
        joinedload(models.Product.offers)
    ).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _build_product_response(product, product.seller)


@app.get("/products", response_model=schemas.PaginatedProductsResponse)
def get_products(
    page: int = 1,
    limit: int = 10,
    status: str = None,
    category: str = None,
    seller_id: int = None,
    search_query: str = None,
    db: Session = Depends(get_db)
):
    """Fetch paginated products."""
    query = db.query(models.Product).options(
        joinedload(models.Product.seller),
        joinedload(models.Product.images),
        joinedload(models.Product.offers)
    )

    if status is not None and status != "all":
        query = query.filter(models.Product.status == status)
    if category is not None and category != "all":
        query = query.filter(models.Product.category == category)
    if seller_id is not None:
        query = query.filter(models.Product.seller_id == seller_id)
    if search_query:
        query = query.filter(models.Product.title.ilike(f"%{search_query}%"))

    query = query.order_by(models.Product.created_at.desc())

    total = query.count()
    pages = (total + limit - 1) // limit if limit > 0 else 1
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()

    results = [_build_product_response(p, p.seller) for p in products]

    return schemas.PaginatedProductsResponse(
        items=results,
        total=total,
        page=page,
        pages=pages,
        has_more=page < pages
    )


@app.patch("/products/{product_id}/status", response_model=schemas.ProductResponse)
def update_product_status(
    product_id: str,
    status_update: schemas.ProductStatusUpdate,
    db: Session = Depends(get_db)
):
    """Update product status."""
    product = db.query(models.Product).options(
        joinedload(models.Product.seller),
        joinedload(models.Product.images),
        joinedload(models.Product.offers)
    ).filter(models.Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = status_update.status
    db.commit()
    db.refresh(product)
    return _build_product_response(product, product.seller)


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a product. Only owner or admin can delete."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Authorization Check
    if current_user.role != models.UserRole.ADMIN and product.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")

    db.delete(product)
    db.commit()
    return


# ─── ADMIN ────────────────────────────────────────────────────────────────────

@app.post("/admin/users/{user_id}/action", response_model=schemas.UserResponse)
def admin_user_action(user_id: int, action_req: schemas.UserActionRequest, db: Session = Depends(get_db)):
    """Apply disciplinary actions to a user."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)

    if action_req.action == "ban_listings_7_days":
        user.listing_banned_until = now + timedelta(days=7)
    elif action_req.action == "suspend_15_days":
        user.suspended_until = now + timedelta(days=15)
    elif action_req.action == "permanent_ban":
        user.account_status = "banned"
        db.query(models.Product).filter(models.Product.seller_id == user_id).delete()
    elif action_req.action == "approve_seller":
        if user.role == "seller":
            user.account_status = "active"
        else:
            raise HTTPException(status_code=400, detail="Only seller accounts can be approved.")
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.commit()
    db.refresh(user)
    return user


# ─── STATS ────────────────────────────────────────────────────────────────────

@app.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    """Returns real-time platform statistics."""
    total_buyers  = db.query(models.User).filter(models.User.role == models.UserRole.BUYER).count()
    total_sellers = db.query(models.User).filter(models.User.role == models.UserRole.SELLER).count()
    total_users   = total_buyers + total_sellers

    satisfaction = 99 if total_users == 0 else min(99, 94 + round(total_users / 10))

    total_products    = db.query(models.Product).count()
    pending_products  = db.query(models.Product).filter(models.Product.status == models.ProductStatus.PENDING).count()
    approved_products = db.query(models.Product).filter(models.Product.status == models.ProductStatus.APPROVED).count()
    rejected_products = db.query(models.Product).filter(models.Product.status == models.ProductStatus.REJECTED).count()

    pending_sellers = db.query(models.User).filter(
        models.User.role == models.UserRole.SELLER,
        models.User.account_status == "pending_verification"
    ).count()

    # Revenue Calculation
    completed_offers = db.query(models.Offer).filter(
        models.Offer.status.in_([models.OfferStatus.COMPLETED, models.OfferStatus.AUTO_COMPLETED])
    ).all()
    total_commission = sum(int(o.offered_price * o.quantity * COMMISSION_RATE) for o in completed_offers)

    return {
        "total_users":       total_users,
        "total_buyers":      total_buyers,
        "total_sellers":     total_sellers,
        "satisfaction_pct":  satisfaction,
        "avg_sale_hours":    24,
        "total_products":    total_products,
        "pending_products":  pending_products,
        "approved_products": approved_products,
        "rejected_products": rejected_products,
        "pending_sellers":   pending_sellers,
        "platform_revenue":  total_commission,
        "total_listings":    total_products,
        "pending_listings":  pending_products,
        "approved_listings": approved_products,
        "rejected_listings": rejected_products,
    }


# ─── CHATS ────────────────────────────────────────────────────────────────────

@app.post("/chats", response_model=schemas.ChatSessionResponse)
def create_chat(chat_in: schemas.ChatSessionCreate, db: Session = Depends(get_db)):
    """Create a new chat session between buyer and seller for a product."""
    existing_chat = db.query(models.ChatSession).filter(
        models.ChatSession.product_id == chat_in.product_id,
        models.ChatSession.buyer_id == chat_in.buyer_id,
        models.ChatSession.seller_id == chat_in.seller_id
    ).first()

    if existing_chat:
        resp = schemas.ChatSessionResponse.model_validate(existing_chat)
        if existing_chat.product:
            resp.product_title = existing_chat.product.title
            resp.product_price = existing_chat.product.price
            resp.product_image_url = existing_chat.product.image_url
        return resp

    new_chat = models.ChatSession(
        product_id=chat_in.product_id,
        buyer_id=chat_in.buyer_id,
        seller_id=chat_in.seller_id
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)

    resp = schemas.ChatSessionResponse.model_validate(new_chat)
    if new_chat.product:
        resp.product_title = new_chat.product.title
        resp.product_price = new_chat.product.price
        resp.product_image_url = new_chat.product.image_url
    return resp


@app.get("/chats", response_model=List[schemas.ChatSessionResponse])
def get_user_chats(user_id: int, db: Session = Depends(get_db)):
    """Fetch all chat sessions for a specific user with optimized loading."""
    chats = db.query(models.ChatSession).options(
        joinedload(models.ChatSession.buyer),
        joinedload(models.ChatSession.seller),
        joinedload(models.ChatSession.product)
    ).filter(
        (models.ChatSession.buyer_id == user_id) | (models.ChatSession.seller_id == user_id)
    ).order_by(models.ChatSession.updated_at.desc()).all()

    results = []
    for chat in chats:
        try:
            resp = schemas.ChatSessionResponse.model_validate(chat)
            if chat.product:
                resp.product_title = chat.product.title
                resp.product_price = chat.product.price
                resp.product_image_url = chat.product.image_url
            
            # Efficient unread count
            unread = db.query(models.ChatMessage).filter(
                models.ChatMessage.session_id == chat.id,
                models.ChatMessage.sender_id != user_id,
                models.ChatMessage.is_read == 0
            ).count()
            resp.unread_count = unread
            results.append(resp)
        except Exception as e:
            print(f"Error validating chat {chat.id}: {e}")
            continue # Skip corrupted entries
    return results


@app.delete("/chats/{session_id}")
def delete_chat(session_id: int, db: Session = Depends(get_db)):
    """Delete a chat session and all its messages."""
    chat = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.delete(chat)
    db.commit()
    return {"status": "success", "message": "Chat session deleted"}


@app.post("/chats/{session_id}/read")
def mark_chat_read(session_id: int, user_id: int, db: Session = Depends(get_db)):
    """Mark all messages in a session as read for the recipient."""
    db.query(models.ChatMessage).filter(
        models.ChatMessage.session_id == session_id,
        models.ChatMessage.sender_id != user_id,
        models.ChatMessage.is_read == 0
    ).update({models.ChatMessage.is_read: 1}, synchronize_session=False)
    db.commit()
    return {"status": "success"}


@app.get("/chats/{session_id}/messages", response_model=List[schemas.MessageResponse])
def get_chat_messages(session_id: int, db: Session = Depends(get_db)):
    """Fetch message history for a chat session."""
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.session_id == session_id
    ).order_by(models.ChatMessage.created_at).all()
    return messages


@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: int, token: str, db: Session = Depends(get_db)):
    """WebSocket endpoint for real-time messaging."""
    payload = auth.decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    email = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    chat_session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not chat_session:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if user.id not in [chat_session.buyer_id, chat_session.seller_id]:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, user.id)
    try:
        while True:
            data = await websocket.receive_text()

            new_msg = models.ChatMessage(
                session_id=session_id,
                sender_id=user.id,
                text=data
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)

            msg_dict = {
                "id": new_msg.id,
                "session_id": new_msg.session_id,
                "sender_id": new_msg.sender_id,
                "text": new_msg.text,
                "created_at": new_msg.created_at.isoformat()
            }

            chat_session.updated_at = func.now()
            db.add(chat_session)
            db.commit()

            await manager.send_personal_message(msg_dict, chat_session.buyer_id)
            if chat_session.buyer_id != chat_session.seller_id:
                await manager.send_personal_message(msg_dict, chat_session.seller_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)


# ─── REVIEWS ──────────────────────────────────────────────────────────────────

@app.post("/reviews", response_model=schemas.ReviewResponse)
def create_review(
    review: schemas.ReviewCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new review for a seller."""
    product = db.query(models.Product).filter(models.Product.id == review.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # RESTRICTION: Only buyers who have a processed transaction (completed or refunded) can review
    purchase = db.query(models.Offer).filter(
        models.Offer.product_id == review.product_id,
        models.Offer.buyer_id == current_user.id,
        models.Offer.status.in_([
            models.OfferStatus.COMPLETED, 
            models.OfferStatus.AUTO_COMPLETED, 
            models.OfferStatus.REFUNDED
        ])
    ).first()

    if not purchase:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review a seller after a transaction has been completed or resolved."
        )

    new_review = models.Review(
        reviewer_id=current_user.id,
        seller_id=product.seller_id,
        product_id=review.product_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(new_review)
    
    # Add system message to chat to notify both parties
    msg_text = f"⭐ Buyer left a {review.rating}-star review: \"{review.comment}\""
    
    review_msg = models.ChatMessage(
        session_id=purchase.session_id,
        sender_id=1, # System User
        text=msg_text
    )
    db.add(review_msg)
    db.flush()
    push_system_msg(review_msg, purchase.buyer_id, purchase.seller_id)
    
    db.commit()
    db.refresh(new_review)
    return new_review

@app.get("/reviews/seller/{seller_id}")
def get_seller_reviews(seller_id: int, db: Session = Depends(get_db)):
    """Fetch all reviews received by a seller."""
    reviews = db.query(models.Review).filter(models.Review.seller_id == seller_id).order_by(models.Review.created_at.desc()).all()
    results = []
    for r in reviews:
        results.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at,
            "buyer_name": r.reviewer.full_name if r.reviewer else "Anonymous Buyer",
            "product_title": r.product.title if r.product else "Deleted Product"
        })
    return results

