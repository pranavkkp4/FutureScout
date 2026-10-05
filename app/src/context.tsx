import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { loadArtifacts } from "./data";
import type { Artifacts } from "./types";

interface ArtifactContextValue {
  artifacts: Artifacts | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

const ArtifactContext = createContext<ArtifactContextValue>({ artifacts: null, error: null, loading: true, retry: () => undefined });

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifacts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setArtifacts(null);
    setError(null);
    loadArtifacts().then(setArtifacts).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The analysis release could not load."));
  }, [attempt]);
  return <ArtifactContext.Provider value={{ artifacts, error, loading: !artifacts && !error, retry: () => setAttempt((value) => value + 1) }}>{children}</ArtifactContext.Provider>;
}

// The hook and provider live together so the artifact lifecycle stays explicit.
// eslint-disable-next-line react-refresh/only-export-components
export function useArtifacts(): Artifacts {
  const value = useContext(ArtifactContext);
  if (!value.artifacts) throw new Error(value.error ?? "Analysis artifacts are still loading.");
  return value.artifacts;
}

export function ArtifactGate({ children }: { children: ReactNode }) {
  const value = useContext(ArtifactContext);
  if (value.loading) return <div className="loading-screen"><div className="loading-card" role="status" aria-live="polite"><span className="loading-mark" /><span>Loading the analysis release</span></div></div>;
  if (value.error) return <div className="loading-screen"><div className="error-box" role="alert"><strong>Analysis release unavailable</strong><p>{value.error}</p><code>python -m analysis.run</code><button className="button button-primary" onClick={value.retry}>Retry artifact load</button></div></div>;
  return <>{children}</>;
}
