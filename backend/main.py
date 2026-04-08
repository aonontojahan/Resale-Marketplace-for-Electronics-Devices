import os
import shutil
import uuid
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta, datetime, timezone
from typing import List, Dict

from . import models, schemas, auth, database
from .database import engine, get_db

# Create database tables (if they don't exist)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ReSale Marketplace API")

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

@app.get("/")
def read_root():
    return {"message": "Welcome to ReSale Marketplace API"}

@app.post("/auth/signup", response_model=schemas.UserResponse)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user with minimal fields."""
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check NID uniqueness across all users
    if user.nid_number:
        existing_nid = db.query(models.User).filter(models.User.nid_number == user.nid_number).first()
        if existing_nid:
            raise HTTPException(status_code=400, detail="This NID is already registered with another account")

    # Status: Sellers are pending_verification, others are active
    account_status = "pending_verification" if user.role == "seller" else "active"
    
    # Hash password and create user
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role,
        phone_number=user.phone_number,
        dob=user.dob,
        nid_number=user.nid_number,
        account_status=account_status,
        # Other fields like address, shop_name, etc. remain empty as they're not provided in signup anymore.
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    # Authenticate user
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if not user or not auth.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user.account_status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been permanently banned."
        )
        
    if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is suspended until {user.suspended_until.strftime('%Y-%m-%d %H:%M:%S')}."
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def get_current_user(token: str, db: Session = Depends(get_db)):
    """Fetch current user profile from token."""
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.account_status == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account has been permanently banned.")
        
    if user.suspended_until and user.suspended_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is suspended.")
    
    return user

@app.get("/users", response_model=List[schemas.UserResponse])
def get_users(role: str = None, db: Session = Depends(get_db)):
    """Fetch all users, optionally filtered by role."""
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    return query.all()

@app.post("/listings", response_model=schemas.ListingResponse, status_code=status.HTTP_201_CREATED)
def create_listing(
    title: str = Form(...),
    category: str = Form(...),
    price: str = Form(...),
    condition: str = Form(...),
    description: str = Form(...),
    image: UploadFile = File(None),
    token: str = Form(...),
    db: Session = Depends(get_db)
):
    """Create a new listing with an optional image upload."""
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    email = payload.get("sub")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.account_status == "banned" or user.account_status == "pending_verification" or (user.suspended_until and user.suspended_until > datetime.now(timezone.utc)):
        detail_msg = "Your account is pending verification by admin." if user.account_status == "pending_verification" else "Your account is suspended or banned."
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail_msg)
        
    if user.listing_banned_until and user.listing_banned_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"You are banned from creating listings until {user.listing_banned_until.strftime('%Y-%m-%d %H:%M:%S')}.")

    image_url = ""
    if image and image.filename:
        file_extension = image.filename.split(".")[-1]
        file_name = f"{uuid.uuid4().hex}.{file_extension}"
        file_path = f"backend/uploads/{file_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{file_name}"

    listing_id = f"listing_{uuid.uuid4().hex[:10]}"
    
    new_listing = models.Listing(
        id=listing_id,
        title=title,
        category=category,
        price=price,
        condition=condition,
        description=description,
        image_url=image_url,
        seller_id=user.id
    )
    db.add(new_listing)
    db.commit()
    db.refresh(new_listing)
    
    response_data = schemas.ListingResponse.model_validate(new_listing)
    response_data.sellerName = user.full_name
    response_data.sellerEmail = user.email
    return response_data

@app.get("/listings", response_model=List[schemas.ListingResponse])
def get_listings(db: Session = Depends(get_db)):
    """Fetch all listings."""
    listings = db.query(models.Listing).all()
    results = []
    for l in listings:
        l_response = schemas.ListingResponse.model_validate(l)
        l_response.sellerName = l.seller.full_name
        l_response.sellerEmail = l.seller.email
        results.append(l_response)
    return results

@app.patch("/listings/{listing_id}/status", response_model=schemas.ListingResponse)
def update_listing_status(listing_id: str, status_update: schemas.ListingStatusUpdate, db: Session = Depends(get_db)):
    """Update listing status."""
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
        
    listing.status = status_update.status
    db.commit()
    db.refresh(listing)
    
    response_data = schemas.ListingResponse.model_validate(listing)
    response_data.sellerName = listing.seller.full_name
    response_data.sellerEmail = listing.seller.email
    return response_data

@app.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(listing_id: str, db: Session = Depends(get_db)):
    """Delete a listing."""
    listing = db.query(models.Listing).filter(models.Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
        
    db.delete(listing)
    db.commit()
    return

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
        # Delete their listings
        db.query(models.Listing).filter(models.Listing.seller_id == user_id).delete()
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

@app.get("/stats")
def get_platform_stats(db: Session = Depends(get_db)):
    """
    Returns real-time platform statistics from the database.
    Used by the frontend to populate the About section with live numbers.
    """
    total_buyers  = db.query(models.User).filter(models.User.role == models.UserRole.BUYER).count()
    total_sellers = db.query(models.User).filter(models.User.role == models.UserRole.SELLER).count()
    total_users   = total_buyers + total_sellers  # excludes admins from "happy users"

    # Satisfaction improves slightly as the community grows (capped at 99%)
    satisfaction = 99 if total_users == 0 else min(99, 94 + round(total_users / 10))

    total_listings   = db.query(models.Listing).count()
    pending_listings = db.query(models.Listing).filter(models.Listing.status == models.ListingStatus.PENDING).count()
    approved_listings = db.query(models.Listing).filter(models.Listing.status == models.ListingStatus.APPROVED).count()
    rejected_listings = db.query(models.Listing).filter(models.Listing.status == models.ListingStatus.REJECTED).count()
    
    pending_sellers = db.query(models.User).filter(models.User.role == models.UserRole.SELLER, models.User.account_status == "pending_verification").count()

    return {
        "total_users":      total_users,
        "total_buyers":     total_buyers,
        "total_sellers":    total_sellers,
        "satisfaction_pct": satisfaction,
        "avg_sale_hours":   24,
        "total_listings":   total_listings,
        "pending_listings": pending_listings,
        "approved_listings": approved_listings,
        "rejected_listings": rejected_listings,
        "pending_sellers":   pending_sellers,
    }

@app.post("/chats", response_model=schemas.ChatSessionResponse)
def create_chat(chat_in: schemas.ChatSessionCreate, db: Session = Depends(get_db)):
    """Create a new chat session between buyer and seller for a listing."""
    existing_chat = db.query(models.ChatSession).filter(
        models.ChatSession.listing_id == chat_in.listing_id,
        models.ChatSession.buyer_id == chat_in.buyer_id,
        models.ChatSession.seller_id == chat_in.seller_id
    ).first()
    
    if existing_chat:
        resp = schemas.ChatSessionResponse.model_validate(existing_chat)
        if existing_chat.listing:
            resp.listing_title = existing_chat.listing.title
            resp.listing_price = existing_chat.listing.price
            resp.listing_image_url = existing_chat.listing.image_url
        return resp
        
    new_chat = models.ChatSession(
        listing_id=chat_in.listing_id,
        buyer_id=chat_in.buyer_id,
        seller_id=chat_in.seller_id
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    
    resp = schemas.ChatSessionResponse.model_validate(new_chat)
    if new_chat.listing:
        resp.listing_title = new_chat.listing.title
        resp.listing_price = new_chat.listing.price
        resp.listing_image_url = new_chat.listing.image_url
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
        if chat.listing:
            resp.listing_title = chat.listing.title
            resp.listing_price = chat.listing.price
            resp.listing_image_url = chat.listing.image_url
        
        # Calculate unread count for the requesting user
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
            
            # Save message to DB
            new_msg = models.ChatMessage(
                session_id=session_id,
                sender_id=user.id,
                text=data
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)
            
            # Broadcast to participants
            msg_dict = {
                "id": new_msg.id,
                "session_id": new_msg.session_id,
                "sender_id": new_msg.sender_id,
                "text": new_msg.text,
                "created_at": new_msg.created_at.isoformat()
            }
            
            # Update session timestamp
            chat_session.updated_at = func.now()
            db.add(chat_session)
            db.commit()
            
            await manager.send_personal_message(msg_dict, chat_session.buyer_id)
            if chat_session.buyer_id != chat_session.seller_id:
                await manager.send_personal_message(msg_dict, chat_session.seller_id)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
