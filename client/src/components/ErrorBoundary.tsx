import React from "react";

type ErrorBoundaryProps = { children: React.ReactNode };

type ErrorBoundaryState = { hasError: boolean };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[ErrorBoundary] Caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: "red" }}>
          Ocorreu um erro ao renderizar a página.
        </div>
      );
    }
    return this.props.children;
  }
}
