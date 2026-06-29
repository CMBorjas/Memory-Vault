import os
import git
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from core.config import VAULT_PATH, logger
from core.database import get_db, AuditLog

router = APIRouter(prefix="/api/revisions", tags=["revisions"])

class RollbackRequest(BaseModel):
    commit_sha: str
    relative_path: str # e.g. "Networking/The Layered Approach/01 - Introduction.md"
    username: str = "Admin"

@router.get("/history")
async def get_vault_history(path: Optional[str] = None):
    """
    Get the Git commit history of the vault or a specific file/folder within it.
    `path` should be relative to the VAULT_PATH (e.g. 'Networking' or 'Networking/Chapter_01/01 - Intro.md')
    """
    try:
        # The git repo is at /app
        repo = git.Repo("/app")
        
        # Resolve path relative to repo root
        # VAULT_PATH is /app/vault, so any path inside it starts with vault/
        search_path = "vault"
        if path:
            # Clean up path
            path = path.strip("/")
            search_path = f"vault/{path}"
            
        commits = list(repo.iter_commits(paths=search_path, max_count=50))
        
        history = []
        for commit in commits:
            history.append({
                "sha": commit.hexsha,
                "author": commit.author.name,
                "email": commit.author.email,
                "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                "message": commit.message.strip(),
            })
        return history
    except Exception as e:
        logger.error(f"Failed to fetch Git history: {e}")
        raise HTTPException(status_code=500, detail=f"Git history error: {str(e)}")

@router.get("/diff")
async def get_file_diff(commit_sha: str, relative_path: str):
    """
    Compare a file at a specific commit with its current workspace version.
    """
    try:
        repo = git.Repo("/app")
        # File path relative to repo root: vault/{relative_path}
        repo_file_path = f"vault/{relative_path.strip('/')}"
        
        # Get content at commit
        commit = repo.commit(commit_sha)
        try:
            old_blob = commit.tree[repo_file_path]
            old_content = old_blob.data_stream.read().decode('utf-8', errors='replace')
        except KeyError:
            # File might not exist in that commit
            old_content = ""
            
        # Get current content from workspace
        full_path = VAULT_PATH / relative_path.strip('/')
        if full_path.exists():
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                current_content = f.read()
        else:
            current_content = ""
            
        return {
            "old_content": old_content,
            "new_content": current_content,
            "path": relative_path
        }
    except Exception as e:
        logger.error(f"Failed to fetch diff: {e}")
        raise HTTPException(status_code=500, detail=f"Diff generation error: {str(e)}")

@router.post("/rollback")
async def rollback_file(req: RollbackRequest, db: Session = Depends(get_db)):
    """
    Rollback a specific file to its state at a commit SHA.
    """
    try:
        repo = git.Repo("/app")
        repo_file_path = f"vault/{req.relative_path.strip('/')}"
        
        # Checkout the file from the specific commit
        repo.git.checkout(req.commit_sha, "--", repo_file_path)
        
        # Commit the rollback action to git automatically
        repo.git.add(repo_file_path)
        commit_msg = f"Rollback {req.relative_path} to commit {req.commit_sha[:8]}"
        repo.index.commit(commit_msg)
        
        # Add to AuditLog
        log = AuditLog(
            username=req.username,
            action="ROLLBACK",
            details=f"Rolled back {req.relative_path} to {req.commit_sha[:8]}"
        )
        db.add(log)
        db.commit()
        
        return {"message": "File rolled back and changes committed successfully."}
    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")

@router.get("/audit-logs")
async def get_audit_logs(db: Session = Depends(get_db)):
    """
    Return all system audit logs.
    """
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return logs
