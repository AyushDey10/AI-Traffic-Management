import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    assert body["model"]["device"] == "cpu"
    assert body["model"]["custom_trained"] is False


def test_config_endpoint():
    response = client.get("/api/config")

    assert response.status_code == 200
    body = response.json()
    assert set(body["approaches"]) == {"North", "South", "East", "West"}
    assert set(body["lane_polygons"]) == {"North", "South", "East", "West"}
    assert body["signal"]["min_green"] > 0
    assert body["simulation"]["fixed_green_seconds"] > 0


def test_video_catalogue():
    response = client.get("/api/videos")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    assert any(video["id"] == "traffic_compressed_crf28.mp4" for video in body["videos"])


def test_frame_analysis_returns_snapshot():
    response = client.post(
        "/api/analysis/frame",
        json={"video_id": "traffic_compressed_crf28.mp4", "timestamp": 10},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["video_id"] == "traffic_compressed_crf28.mp4"
    assert body["timestamp"] == 10
    assert len(body["lanes"]) == 4
    assert body["image_url"].startswith("/media/")
    assert body["signal"]["green_duration"] >= 0
    assert body["congestion_summary"]["is_snapshot"] is True

    image = client.get(body["image_url"])
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"


def test_frame_analysis_rejects_schema_violations():
    response = client.post(
        "/api/analysis/frame",
        json={"video_id": "traffic_compressed_crf28.mp4", "timestamp": 9999},
    )
    assert response.status_code == 422


def test_frame_analysis_rejects_timestamp_past_video_end():
    response = client.post(
        "/api/analysis/frame",
        json={"video_id": "traffic_compressed_crf28.mp4", "timestamp": 120},
    )
    assert response.status_code == 400
    assert "outside the video" in response.json()["detail"]


def test_frame_analysis_missing_video():
    response = client.post(
        "/api/analysis/frame",
        json={"video_id": "does_not_exist.mp4", "timestamp": 5},
    )
    assert response.status_code == 404


def test_analysis_job_lifecycle():
    created = client.post(
        "/api/analysis/jobs",
        json={"video_id": "traffic_compressed_crf28.mp4", "interval_seconds": 10, "limit": 2},
    )
    assert created.status_code == 202
    job_id = created.json()["job_id"]

    status = client.get(f"/api/analysis/jobs/{job_id}")
    assert status.status_code == 200
    assert status.json()["status"] in {"queued", "running", "completed"}


def test_analysis_job_unknown_id():
    assert client.get("/api/analysis/jobs/nope").status_code == 404


def test_simulation_compare():
    response = client.post("/api/simulation/compare", json={"duration": 300, "seed": 42})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"seed", "fixed_time", "adaptive"}
    assert body["fixed_time"]["total_arrivals"] == body["adaptive"]["total_arrivals"]
    assert len(body["adaptive"]["timeseries"]["t"]) > 0


def test_simulation_invalid_policy():
    response = client.post(
        "/api/simulation/run",
        json={"duration": 300, "seed": 1, "policy": "magic"},
    )
    assert response.status_code == 422


def test_seed_sweep():
    response = client.post("/api/simulation/seeds", json={"duration": 180, "seeds": [0, 1, 2]})

    assert response.status_code == 200
    body = response.json()
    assert body["seed_count"] == 3
    assert len(body["rows"]) == 3


def test_seed_sweep_rejects_duplicates():
    response = client.post("/api/simulation/seeds", json={"duration": 180, "seeds": [1, 1]})
    assert response.status_code == 400


def test_signal_recommendation():
    response = client.post(
        "/api/signals/recommend",
        json={"demand": {"North": 1, "South": 0, "East": 8, "West": 2}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["green_lane"] == "East"
    assert body["green_duration"] >= 12


def test_signal_recommendation_uses_fairness():
    response = client.post(
        "/api/signals/recommend",
        json={
            "demand": {"North": 3, "South": 2, "East": 40, "West": 2},
            "wait": {"North": 5, "South": 95, "East": 2, "West": 2},
        },
    )

    assert response.status_code == 200
    assert response.json()["green_lane"] == "South"
    assert response.json()["priority"] == "max_wait"


def test_signal_rejects_unknown_approach():
    response = client.post("/api/signals/recommend", json={"demand": {"Up": 4}})
    assert response.status_code == 400


def test_upload_rejects_non_video():
    response = client.post(
        "/api/videos/upload",
        files={"file": ("notes.txt", b"not a video", "text/plain")},
    )
    assert response.status_code == 400


def test_processed_video_supports_range_requests():
    response = client.get("/api/videos/traffic_compressed_crf28.mp4/processed", headers={"Range": "bytes=0-1023"})

    if response.status_code == 404:
        pytest.skip("No annotated video has been generated yet")

    assert response.status_code == 206
    assert response.headers["content-range"].startswith("bytes 0-1023/")
    assert len(response.content) == 1024
