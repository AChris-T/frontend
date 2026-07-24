FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for OpenCV and GeoPandas
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libx11-6 \
    libxext6 \
    libsm6 \
    libxrender1 \
    libgdal-dev \
    gdal-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (includes data/UI_Campus_Roads.gpkg)
COPY . .

# Start the application — Railway (and Render) assign the port via $PORT at
# runtime; JSON-array CMD can't expand env vars, so this needs shell form.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
