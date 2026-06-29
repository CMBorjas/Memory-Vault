from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from core.database import get_db, ContentBlock

router = APIRouter(prefix="/api/blocks", tags=["blocks"])

class ContentBlockCreate(BaseModel):
    name: str
    content: str
    description: str = None

class ContentBlockResponse(BaseModel):
    id: int
    name: str
    content: str
    description: str = None
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[ContentBlockResponse])
async def list_blocks(db: Session = Depends(get_db)):
    return db.query(ContentBlock).all()

@router.post("", response_model=ContentBlockResponse)
async def create_block(block: ContentBlockCreate, db: Session = Depends(get_db)):
    existing = db.query(ContentBlock).filter(ContentBlock.name == block.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Block name already exists")
        
    new_block = ContentBlock(
        name=block.name,
        content=block.content,
        description=block.description
    )
    db.add(new_block)
    db.commit()
    db.refresh(new_block)
    return new_block

@router.put("/{name}", response_model=ContentBlockResponse)
async def update_block(name: str, block: ContentBlockCreate, db: Session = Depends(get_db)):
    existing = db.query(ContentBlock).filter(ContentBlock.name == name).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Block not found")
        
    existing.name = block.name
    existing.content = block.content
    existing.description = block.description
    existing.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/{name}")
async def delete_block(name: str, db: Session = Depends(get_db)):
    existing = db.query(ContentBlock).filter(ContentBlock.name == name).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Block not found")
        
    db.delete(existing)
    db.commit()
    return {"message": "Content block deleted successfully."}
