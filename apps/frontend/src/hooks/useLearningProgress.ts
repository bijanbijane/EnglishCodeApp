import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Profile, type ProgressEntry } from "../api";

export function useLearningProgress(
  profile: Profile | null,
  onError: (error: unknown) => void,
) {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const requestVersion = useRef(0);

  const refreshProgress = useCallback(async () => {
    const requestId = requestVersion.current;
    setProgressLoading(true);
    try {
      const entries = await api.progress();
      if (requestId === requestVersion.current) setProgress(entries);
      return entries;
    } finally {
      if (requestId === requestVersion.current) setProgressLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestId = ++requestVersion.current;
    if (!profile) {
      setProgress([]);
      setProgressLoading(false);
      return;
    }

    void refreshProgress().catch(onError);
    return () => {
      // Ignore responses from a previous account/session after profile changes
      // or the owning component unmounts.
      if (requestVersion.current === requestId) requestVersion.current += 1;
    };
  }, [profile, onError, refreshProgress]);

  return { progress, progressLoading, refreshProgress };
}
