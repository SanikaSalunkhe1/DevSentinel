import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="DevSentinel AI & Intelligence Service",
    description="Anomaly detection, AI Root Cause Analysis, and RAG Knowledge Assistant service",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

start_time = time.time()

@app.get("/")
def read_root():
    return {
        "service": "DevSentinel AI Service",
        "version": "0.1.0",
        "status": "operational"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "devsentinel-ai-service",
        "uptime_seconds": round(time.time() - start_time, 2)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
