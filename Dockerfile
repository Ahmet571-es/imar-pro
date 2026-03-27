FROM python:3.12-slim

# DejaVu fonts for PDF Turkish character support (İ,Ş,Ç,Ö,Ü,Ğ)
RUN apt-get update && \
    apt-get install -y --no-install-recommends fonts-dejavu-core fonts-dejavu-extra && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Expose port
EXPOSE 10000

# Start uvicorn
CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 2 --timeout-keep-alive 300"]
