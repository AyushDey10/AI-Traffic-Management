import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type FrameSnapshot, type Health, type VideoInfo } from "./api";

interface TrafficContextValue {
  health: Health | null;
  videos: VideoInfo[];
  videoId: string;
  selectVideo: (id: string) => void;
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

  // Refs keep asynchronous results from landing after the user moved on.
  const videoIdRef = useRef("");
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const selectVideo = useCallback((id: string) => {
    if (!id || id === videoIdRef.current) return;

    // Any result still in flight belongs to the previous video.
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;

    videoIdRef.current = id;
    setVideoId(id);
    setSnapshot(null);
    setError(null);
    setLoading(false);
  }, []);

  const analyse = useCallback(async (video: string, timestamp: number) => {
    // Never analyse a video the user has already switched away from.
    if (!video || video !== videoIdRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyseFrame(
        { video_id: video, timestamp },
        { signal: controller.signal },
      );
      if (requestId !== requestRef.current || video !== videoIdRef.current) return;
      setSnapshot(result);
    } catch (cause) {
      if (controller.signal.aborted || requestId !== requestRef.current) return;
      setError(errorMessage(cause));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
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
          selectVideo(first.id);
          await analyse(first.id, Math.min(10, Math.max(0, first.duration_seconds - 1)));
        }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [analyse, selectVideo]);

  const value = useMemo(
    () => ({
      health,
      videos,
      videoId,
      selectVideo,
      snapshot,
      loading,
      error,
      analyse,
      refreshVideos,
      dismissError: () => setError(null),
    }),
    [health, videos, videoId, selectVideo, snapshot, loading, error, analyse, refreshVideos],
  );

  return <TrafficContext.Provider value={value}>{children}</TrafficContext.Provider>;
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) throw new Error("useTraffic must be used inside TrafficProvider");
  return context;
}
