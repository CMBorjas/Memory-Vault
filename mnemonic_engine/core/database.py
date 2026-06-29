import os
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# Locate db in the mounted data directory so it persists
DATA_PATH = Path(os.getenv("DATA_PATH", "./data"))
DB_URL = f"sqlite:///{DATA_PATH}/memory_vault.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Many-to-many relationship for user roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    mfa_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    preferences = relationship("UserPreference", uselist=False, back_populates="user", cascade="all, delete-orphan")

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # 'Admin', 'Editor', 'Guest'
    users = relationship("User", secondary=user_roles, back_populates="roles")

class UserPreference(Base):
    __tablename__ = "user_preferences"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(String, default="dark") # 'dark' or 'light'
    language = Column(String, default="en") # 'en', 'es', etc.
    user = relationship("User", back_populates="preferences")

class Shelf(Base):
    __tablename__ = "shelves"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    books = relationship("BookAssociation", back_populates="shelf", cascade="all, delete-orphan")

class BookAssociation(Base):
    __tablename__ = "book_associations"
    id = Column(Integer, primary_key=True)
    shelf_id = Column(Integer, ForeignKey("shelves.id", ondelete="CASCADE"))
    book_name = Column(String, nullable=False)
    shelf = relationship("Shelf", back_populates="books")

class ContentBlock(Base):
    __tablename__ = "content_blocks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g. "Withering Ambrosia Newts"
    content = Column(String, nullable=False) # HTML/Markdown block content
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    username = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Pre-populate default roles and a default user if they don't exist
    db = SessionLocal()
    try:
        # Create roles
        for r_name in ["Admin", "Editor", "Guest"]:
            role = db.query(Role).filter(Role.name == r_name).first()
            if not role:
                db.add(Role(name=r_name))
        db.commit()

        # Create admin user if no users exist
        if db.query(User).count() == 0:
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

            admin_role = db.query(Role).filter(Role.name == "Admin").first()
            
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=pwd_context.hash("admin123"),
                mfa_enabled=False
            )
            admin_user.roles.append(admin_role)
            db.add(admin_user)
            db.commit()

            # Default preferences for admin
            prefs = UserPreference(user_id=admin_user.id, theme="dark", language="en")
            db.add(prefs)
            db.commit()

        # Create default shelves if none exist
        if db.query(Shelf).count() == 0:
            cs_shelf = Shelf(name="Computer Science", description="Core software and hardware subjects")
            security_shelf = Shelf(name="Security & Operations", description="Cybersecurity and systems administration")
            project_shelf = Shelf(name="Project Documentation", description="Internal documentation and reference logs")
            
            db.add_all([cs_shelf, security_shelf, project_shelf])
            db.commit()
            
            # Associate books
            db.add_all([
                BookAssociation(shelf_id=cs_shelf.id, book_name="Networking"),
                BookAssociation(shelf_id=cs_shelf.id, book_name="Databases"),
                BookAssociation(shelf_id=cs_shelf.id, book_name="Operating_Systems"),
                BookAssociation(shelf_id=cs_shelf.id, book_name="Algorithms"),
                BookAssociation(shelf_id=security_shelf.id, book_name="Cybersecurity"),
                BookAssociation(shelf_id=project_shelf.id, book_name="Memory_Vault")
            ])
            db.commit()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
