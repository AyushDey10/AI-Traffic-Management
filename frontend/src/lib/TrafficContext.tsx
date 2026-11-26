import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type FrameSnapshot, type Health, type VideoInfo } from "./api";

interface TrafficContextValue {
  health: Health | null;
  videos: VideoInfo[];
  videoId: string;
  setVideoId: (id: string) => void;
  snapshot: FrameSnapshot | null;
  loading: boolean;
  error: string | null;
  analyse: (videoId: string, timestamp: number) => Promise<void>;
  refreshVideos: () => Promise<VideoInfo[]>;
  dismissError: () => void;
}

const TrafficContext = createContext<TrafficContextValue | null>(null);

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function TrafficProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [videoId, setVideoId] = useState("");
  const [snapshot, setSnapshot] = useState<FrameSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyse = useCallback(async (video: string, timestamp: number) => {
    if (!video) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyseFrame({ video_id: video, timestamp });
      setSnapshot(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshVideos = useCallback(async () => {
    const response = await api.videos();
    setVideos(response.videos);
    return response.videos;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [healthResponse, videoResponse] = await Promise.all([api.health(), api.videos()]);
        if (cancelled) return;
        setHealth(healthResponse);
        setVideos(videoResponse.videos);

        const first = videoResponse.videos[0];
        if (first) {
          setVideoId(first.id);
          await analyse(first.id, Math.min(10, Math.max(0, first.duration_seconds - 1)));
        }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [analyse]);

  const value = useMemo(
    () => ({
      health,
      videos,
      videoId,
      setVideoId,
      snapshot,
      loading,
      error,
      analyse,
      refreshVideos,
      dismissError: () => setError(null),
    }),
    [health, videos, videoId, snapshot, loading, error, analyse, refreshVideos],
  );

  return <TrafficContext.Provider value={value}>{children}</TrafficContext.Provider>;
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) throw new Error("useTraffic must be used inside TrafficProvider");
  return context;
}
