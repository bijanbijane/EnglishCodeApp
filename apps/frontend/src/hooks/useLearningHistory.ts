import { useCallback, useEffect, useRef, useState } from "react";
import { api, type LearningHistoryEntry, type Profile } from "../api";

type Options = {
  profile: Profile | null;
  onError: (error: unknown) => void;
};

export function useLearningHistory({ profile, onError }: Options) {
  const [history, setHistory] = useState<LearningHistoryEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);

  const refreshHistory = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    setLoadFailed(false);
    try {
      const page = await api.history();
      if (generation.current !== requestGeneration) return;
      setHistory(page.data);
      setNextCursor(page.meta?.nextCursor ?? null);
      setLoadFailed(false);
    } catch (error) {
      if (generation.current === requestGeneration) {
        setLoadFailed(true);
        onError(error);
      }
    } finally {
      if (generation.current === requestGeneration) setLoading(false);
    }
  }, [onError]);

  const loadMoreHistory = useCallback(async () => {
    const cursor = nextCursor;
    if (!cursor || loadingMore) return;
    const requestGeneration = generation.current;
    setLoadingMore(true);
    try {
      const page = await api.history(5, cursor);
      if (generation.current !== requestGeneration) return;
      setHistory((current) => {
        const knownIds = new Set(current.map((item) => item.attemptId));
        return [...current, ...page.data.filter((item) => !knownIds.has(item.attemptId))];
      });
      setNextCursor(page.meta?.nextCursor ?? null);
    } catch (error) {
      if (generation.current === requestGeneration) onError(error);
    } finally {
      if (generation.current === requestGeneration) setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, onError]);

  useEffect(() => {
    if (!profile) {
      generation.current += 1;
      setHistory([]);
      setNextCursor(null);
      setLoading(false);
      setLoadingMore(false);
      setLoadFailed(false);
      return;
    }
    void refreshHistory();
    return () => { generation.current += 1; };
  }, [profile, refreshHistory]);

  return {
    history,
    historyLoading: loading,
    historyLoadFailed: loadFailed,
    historyLoadingMore: loadingMore,
    hasMoreHistory: nextCursor !== null,
    refreshHistory,
    loadMoreHistory,
  };
}
