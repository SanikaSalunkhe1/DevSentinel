import React from 'react';

export default function App() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      padding: '2rem',
      backgroundColor: '#0b0f19',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        padding: '2.5rem',
        borderRadius: '1rem',
        backgroundColor: '#111827',
        border: '1px solid #1f2937',
        maxWidth: '600px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: '#064e3b',
          color: '#34d399',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '1rem'
        }}>
          ● System Initialized
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0.5rem 0', letterSpacing: '-0.025em' }}>
          DevSentinel
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.125rem', marginBottom: '1.5rem' }}>
          AI-Powered Application Monitoring &amp; Incident Intelligence Platform
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          textAlign: 'left',
          marginTop: '1.5rem',
          borderTop: '1px solid #1f2937',
          paddingTop: '1.5rem'
        }}>
          <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Frontend</div>
            <div style={{ fontWeight: 600, color: '#38bdf8' }}>React 18 + Vite</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Backend</div>
            <div style={{ fontWeight: 600, color: '#4ade80' }}>Node + Express</div>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>AI Engine</div>
            <div style={{ fontWeight: 600, color: '#f472b6' }}>FastAPI + Gemini</div>
          </div>
        </div>
      </div>
    </div>
  );
}
