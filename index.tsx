import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("[System] Initializing Application...");

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, info: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[System] Critical Error Caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#0f172a', color: '#ef4444', height: '100vh', fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⚠ Application Crashed</h1>
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
  console.error("[System] Root element not found!");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);