import { Component, type ErrorInfo, type ReactNode } from "react";
import { isStaleChunkError } from "@/lib/stale-chunk-error";

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

export default class ChunkLoadErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isStaleChunkError(error)) {
      console.warn("A stale application asset could not be loaded after automatic recovery", {
        componentStack: info.componentStack,
      });
    }
  }

  render() {
    if (this.state.error === null) return this.props.children;
    if (!isStaleChunkError(this.state.error)) throw this.state.error;

    return (
      <section className="min-h-[50vh] flex items-center justify-center px-4" role="alert">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900">Application update available</h1>
          <p className="mt-2 text-sm text-gray-600">
            Refresh this page to load the latest version. Your submitted information is unchanged.
          </p>
          <button
            type="button"
            className="mt-5 rounded-md bg-[#C9A04C] px-4 py-2 font-medium text-white hover:bg-[#b58f43]"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      </section>
    );
  }
}
