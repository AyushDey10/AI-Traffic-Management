"""Request/response models for the traffic API."""

from typing import Literal

from pydantic import BaseModel, Field

APPROACHES = ("North", "South", "East", "West")


class FrameAnalysisRequest(BaseModel):
    video_id: str = Field(default="traffic_compressed_crf28.mp4", description="File name from /api/videos")
    timestamp: float = Field(default=10.0, ge=0, le=3600, description="Seek position in seconds")
    confidence: float = Field(default=0.10, gt=0.0, le=1.0)
    image_size: int = Field(default=1280, ge=320, le=2560)


class AnalysisJobRequest(BaseModel):
    video_id: str = Field(default="traffic_compressed_crf28.mp4")
    interval_seconds: float = Field(default=5.0, ge=0.5, le=60)
    limit: int = Field(default=8, ge=1, le=40)
    confidence: float = Field(default=0.10, gt=0.0, le=1.0)
    image_size: int = Field(default=1280, ge=320, le=2560)


class SimulationRequest(BaseModel):
    duration: int = Field(default=600, ge=60, le=1800)
    seed: int = Field(default=42, ge=0, le=99999)
    policy: Literal["fixed", "adaptive"] = "adaptive"


class SimulationCompareRequest(BaseModel):
    duration: int = Field(default=600, ge=60, le=1800)
    seed: int = Field(default=42, ge=0, le=99999)


class SeedSweepRequest(BaseModel):
    duration: int = Field(default=600, ge=60, le=1800)
    seeds: list[int] = Field(default_factory=lambda: list(range(10)), min_length=1, max_length=25)


class SignalRequest(BaseModel):
    demand: dict[str, float] = Field(
        default_factory=lambda: {approach: 0.0 for approach in APPROACHES}
    )
    wait: dict[str, float] | None = None


class ErrorResponse(BaseModel):
    detail: str
