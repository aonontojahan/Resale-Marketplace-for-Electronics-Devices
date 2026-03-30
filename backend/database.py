import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get DB URL from environment or fallback to common local configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/resale_db")

# Create engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for models
Base = declarative_base()

def get_db():
    """Dependency for providing a database session to endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
