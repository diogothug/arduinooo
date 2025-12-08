import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("🟦 [Index] Module loaded. Starting React Boot Sequence...");

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { 
    hasError: false, 
    error: null, 
    info: null 
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("⛔ [Index] Critical Error Caught in Boundary:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#0f172a', color: '#ef4444', height: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠ Application Crashed (Boundary)</h1>
          <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto' }}>
             <strong style={{ color: '#f87171' }}>{this.state.error?.name}: {this.state.error?.message}</strong>
             <pre style={{ marginTop: '1rem', opacity: 0.7, fontSize: '0.8rem' }}>
                 {this.state.error?.stack}
             </pre>
          </div>
          <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Check the browser console (F12) for detailed logs.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("⛔ [Index] Root element 'root' not found in DOM!");
  throw new Error("Could not find root element to mount to");
} else {
    console.log("🟦 [Index] Root element found. Creating React Root...");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    console.log("🟦 [Index] Root created. Rendering App...");
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("🟩 [Index] React Mount command sent successfully.");
} catch(e: any) {
    console.error("⛔ [Index] Failed to call root.render:", e);
    // Try to update UI manually if React fails hard
    if(rootElement) rootElement.innerHTML = `<div style="color:red; padding:20px">Failed to mount React: ${e.message}</div>`;
}