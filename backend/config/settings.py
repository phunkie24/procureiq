"""
config/settings.py
Central configuration — thresholds, model tiers, open-source service endpoints.
Ch.16 Resource-Aware Optimization: model tier selection lives here.
"""

from __future__ import annotations
from decimal import Decimal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class AgentThresholds(BaseSettings):
    """
    Delegation thresholds — Ch.13 Human-in-the-Loop.
    All values in NGN (Naira). Configurable per environment.
    """
    rfq_autonomous_max: Decimal = Decimal("50_000_000")
    rfq_strategic_min: Decimal = Decimal("500_000_000")
    award_autonomous_max: Decimal = Decimal("100_000_000")
    award_human_min: Decimal = Decimal("100_000_000")
    po_autonomous_max: Decimal = Decimal("100_000_000")
    min_confidence_score: float = 0.75

    bid_weight_price: float = 0.35
    bid_weight_quality: float = 0.25
    bid_weight_delivery: float = 0.20
    bid_weight_compliance: float = 0.10
    bid_weight_nigerian_content: float = 0.10

    model_config = SettingsConfigDict(env_prefix="PROCUREMENT_THRESHOLD_", extra="ignore")


class ModelConfig(BaseSettings):
    """
    Model tier selection — Ch.16 Resource-Aware Optimization.
    """
    primary_model: str = "claude-sonnet-4-6"
    primary_max_tokens: int = 4096

    fast_model: str = "claude-haiku-4-5-20251001"
    fast_max_tokens: int = 1024

    max_retries: int = 3
    retry_backoff_seconds: float = 2.0

    model_config = SettingsConfigDict(env_prefix="PROCUREMENT_MODEL_", extra="ignore")


class AppSettings(BaseSettings):
    """Top-level application settings — all service config lives here (no Azure)."""

    # ── App ───────────────────────────────────────────────────
    environment: str = "development"
    log_level: str = "INFO"
    shadow_mode: bool = True
    max_parallel_bids: int = 10
    reflection_max_iterations: int = 3
    planning_max_steps: int = 20

    # ── LLM ──────────────────────────────────────────────────
    anthropic_api_key: str = ""

    # ── ChromaDB vector store (RAG — Ch.14) ──────────────────
    chroma_host: str = "chromadb"       # Docker service name; use "localhost" locally
    chroma_port: int = 8001
    chroma_collection_prefix: str = "procurement"

    # ── ERP / SAP mock ───────────────────────────────────────
    erp_mock_mode: bool = True
    erp_base_url: str = "http://localhost:8080/erp"
    erp_api_key: str = ""

    # ── Email ─────────────────────────────────────────────────
    smtp_host: str = "localhost"
    smtp_port: int = 25
    email_from: str = "procurement-agent@example.com"
    vendor_portal_url: str = "https://vendor-portal.example.com"

    # ── Nested configs ────────────────────────────────────────
    thresholds: AgentThresholds = AgentThresholds()
    models: ModelConfig = ModelConfig()

    model_config = SettingsConfigDict(
        env_prefix="PROCUREMENT_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Singleton
settings = AppSettings()
