import pyotp
import jwt
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.database import get_db, User, Role, UserPreference

SECRET_KEY = "anti_gravity_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    mfa_required: bool

class MFAVerify(BaseModel):
    username: str
    totp_code: str

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_hash_password(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        # Default back to an admin context if no token is provided, to allow unauthenticated development
        return {"username": "admin", "roles": ["Admin"], "theme": "dark", "language": "en"}
        
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
        
    roles = [r.name for r in user.roles]
    theme = user.preferences.theme if user.preferences else "dark"
    language = user.preferences.language if user.preferences else "en"
    
    return {
        "username": user.username,
        "roles": roles,
        "theme": theme,
        "language": language,
        "id": user.id
    }

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):
        user_roles = current_user.get("roles", [])
        if not any(role in self.allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your role hierarchy."
            )
        return current_user

@router.post("/register")
async def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
        
    guest_role = db.query(Role).filter(Role.name == "Guest").first()
    mfa_sec = pyotp.random_base32()
    
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_hash_password(user_in.password),
        mfa_secret=mfa_sec,
        mfa_enabled=False
    )
    if guest_role:
        new_user.roles.append(guest_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    prefs = UserPreference(user_id=new_user.id, theme="dark", language="en")
    db.add(prefs)
    db.commit()
    
    totp = pyotp.TOTP(mfa_sec)
    return {
        "msg": "Registration successful. Please set up MFA.",
        "mfa_uri": totp.provisioning_uri(name=user_in.email, issuer_name="AGKE Mnemonic Vault"),
        "mfa_secret": mfa_sec
    }

@router.post("/token", response_model=Token)
async def login_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    # Standard check for MFA
    mfa_required = user.mfa_enabled
    access_token = create_access_token(data={"sub": user.username, "mfa_pending": mfa_required})
    return {"access_token": access_token, "token_type": "bearer", "mfa_required": mfa_required}

@router.post("/verify-mfa")
async def verify_mfa(verify: MFAVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == verify.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(verify.totp_code):
        raise HTTPException(status_code=400, detail="Invalid MFA Code")
        
    if not user.mfa_enabled:
        user.mfa_enabled = True
        db.commit()
        
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

class PreferencesUpdate(BaseModel):
    theme: str
    language: str

@router.get("/preferences")
async def get_preferences(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    # If using dev mocked admin, handle cleanly
    if current_user.get("username") == "admin" and "id" not in current_user:
        return {"theme": "dark", "language": "en"}
    
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user["id"]).first()
    if not pref:
        return {"theme": "dark", "language": "en"}
    return {"theme": pref.theme, "language": pref.language}

@router.put("/preferences")
async def update_preferences(pref_in: PreferencesUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.get("username") == "admin" and "id" not in current_user:
        # For mock/unauthenticated mode, return success
        return {"message": "Preferences updated (mocked)", "theme": pref_in.theme, "language": pref_in.language}
        
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user["id"]).first()
    if not pref:
        pref = UserPreference(user_id=current_user["id"], theme=pref_in.theme, language=pref_in.language)
        db.add(pref)
    else:
        pref.theme = pref_in.theme
        pref.language = pref_in.language
    db.commit()
    return {"message": "Preferences updated successfully", "theme": pref.theme, "language": pref.language}

