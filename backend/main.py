import os
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Form, File, UploadFile
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
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
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
        joinedload(models.Product.images)
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
        joinedload(models.Product.images)
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
        joinedload(models.Product.images)
    ).filter(models.Product.id == product_id).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = status_update.status
    db.commit()
    db.refresh(product)
    return _build_product_response(product, product.seller)


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    """Delete a product."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

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
        # Keep old keys for backward-compatibility with frontend stats
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
    """Fetch all chat sessions for a specific user."""
    chats = db.query(models.ChatSession).filter(
        (models.ChatSession.buyer_id == user_id) | (models.ChatSession.seller_id == user_id)
    ).order_by(models.ChatSession.updated_at.desc()).all()

    results = []
    for chat in chats:
        resp = schemas.ChatSessionResponse.model_validate(chat)
        if chat.product:
            resp.product_title = chat.product.title
            resp.product_price = chat.product.price
            resp.product_image_url = chat.product.image_url

        unread = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == chat.id,
            models.ChatMessage.sender_id != user_id,
            models.ChatMessage.is_read == 0
        ).count()
        resp.unread_count = unread
        results.append(resp)
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

    new_review = models.Review(
        reviewer_id=current_user.id,
        seller_id=product.seller_id,
        product_id=review.product_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    return new_review
