// src/app/App.tsx
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import { Navbar } from '../components/Navbar';
import { AppRoutes } from './routes';
import { ErrorBoundary } from '../components/ErrorBoundary';
import '../index.css';

export function App() {
  return (
    <ErrorBoundary fallbackTitle="MediFind Application Error">
      <BrowserRouter>
        <AuthProvider>
          <div
            className="app-layout"
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface-canvas)',
              color: 'var(--color-text-primary)',
            }}
          >
            {/* Global Header */}
            <Navbar />

            {/* Main Application Content */}
            <main style={{ flex: 1 }}>
              <AppRoutes />
            </main>

            {/* Healthcare Safety & Regulatory Integrity Footer */}
            <footer
              style={{
                backgroundColor: 'var(--color-surface-panel)',
                borderTop: '1px solid var(--color-border-default)',
                padding: '24px 16px',
                textAlign: 'center',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                marginTop: 'auto',
              }}
            >
              <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  MediFind Pharmacy Operations & Healthcare Discovery Platform
                </p>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  Availability information is pharmacy-reported and does not constitute guaranteed inventory, medical advice,
                  diagnosis, or prescription fulfillment. Pending pharmacies are not publicly listed until verified by
                  regulatory authorities.
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
