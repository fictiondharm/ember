import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "FleetGrid API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Database — prefer DATABASE_URL env var (Neon / Render Postgres)
    # Falls back to local SQLite for offline development
    raw_db_url = os.getenv(
        "DATABASE_URL",
        "sqlite:///./fleetgrid.db"  # fallback for local dev without PostgreSQL
    )
    # Render free tier uses postgres:// but SQLAlchemy needs postgresql://
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    DATABASE_URL: str = raw_db_url

    # Connection pool settings (ignored for SQLite)
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", 5))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", 10))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", 30))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", 1800))

    # CORS (allow all origins by default for hackathon multi-laptop setup)
    raw_cors = os.getenv("CORS_ORIGINS", "*")
    CORS_ORIGINS: List[str] = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

    # ElevenLabs
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "")
    ELEVENLABS_AGENT_ID: str = os.getenv("ELEVENLABS_AGENT_ID", "")

    # Dodo Payments
    DODO_PAYMENTS_API_KEY: str = os.getenv("DODO_PAYMENTS_API_KEY", "")
    DODO_WEBHOOK_SECRET: str = os.getenv("DODO_WEBHOOK_SECRET", "")

    # EVM Blockchain (Proof Anchoring)
    EVM_RPC_URL: str = os.getenv("EVM_RPC_URL", "")
    EVM_PRIVATE_KEY: str = os.getenv("EVM_PRIVATE_KEY", "")
    EVM_PROOF_CONTRACT_ADDRESS: str = os.getenv("EVM_PROOF_CONTRACT_ADDRESS", "")

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql://")

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

settings = Settings()
