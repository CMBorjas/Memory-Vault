from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from core.database import get_db, Shelf, BookAssociation

router = APIRouter(prefix="/api/shelves", tags=["shelves"])

class ShelfCreate(BaseModel):
    name: str
    description: str = None

class BookAssociate(BaseModel):
    book_name: str

class ShelfResponse(BaseModel):
    id: int
    name: str
    description: str = None
    books: List[str]

    class Config:
        from_attributes = True

@router.get("", response_model=List[ShelfResponse])
async def list_shelves(db: Session = Depends(get_db)):
    shelves = db.query(Shelf).all()
    results = []
    for s in shelves:
        results.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "books": [b.book_name for b in s.books]
        })
    return results

@router.post("", response_model=ShelfResponse)
async def create_shelf(shelf: ShelfCreate, db: Session = Depends(get_db)):
    existing = db.query(Shelf).filter(Shelf.name == shelf.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shelf already exists")
    
    new_shelf = Shelf(name=shelf.name, description=shelf.description)
    db.add(new_shelf)
    db.commit()
    db.refresh(new_shelf)
    return {
        "id": new_shelf.id,
        "name": new_shelf.name,
        "description": new_shelf.description,
        "books": []
    }

@router.post("/{shelf_id}/books")
async def add_book_to_shelf(shelf_id: int, book: BookAssociate, db: Session = Depends(get_db)):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
        
    # Check if already associated
    exists = db.query(BookAssociation).filter(
        BookAssociation.shelf_id == shelf_id,
        BookAssociation.book_name == book.book_name
    ).first()
    
    if exists:
        return {"message": "Book already on shelf"}
        
    assoc = BookAssociation(shelf_id=shelf_id, book_name=book.book_name)
    db.add(assoc)
    db.commit()
    return {"message": f"Added '{book.book_name}' to shelf '{shelf.name}'"}

@router.delete("/{shelf_id}/books/{book_name}")
async def remove_book_from_shelf(shelf_id: int, book_name: str, db: Session = Depends(get_db)):
    assoc = db.query(BookAssociation).filter(
        BookAssociation.shelf_id == shelf_id,
        BookAssociation.book_name == book_name
    ).first()
    
    if not assoc:
        raise HTTPException(status_code=404, detail="Association not found")
        
    db.delete(assoc)
    db.commit()
    return {"message": "Book removed from shelf"}
