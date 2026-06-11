# ══════════════════════════════════════════════════════════
#  Anti-Gravity Mnemonic Engine
#  Containerized FastAPI application serving the mnemonic
#  generation pipeline and web GUI.
# ══════════════════════════════════════════════════════════
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_HOME=/app

# Create and set the working directory
WORKDIR $APP_HOME

# Install dependencies first (layer caching)
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/processed /vault

# Create a non-root user and switch to it for security
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser $APP_HOME /vault
USER appuser

# Expose the web server port
EXPOSE 8000

# Run the FastAPI application
ENTRYPOINT ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
