'use client'

/**
 * Replaces the framework default, which renders its own document and cannot be
 * prerendered alongside our root layout. It also has a job of its own: this is
 * the last thing a user sees when everything else has failed, so it must not
 * depend on anything that can fail, including the design system.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          background: '#101215',
          color: '#f5f6f7',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something broke</h1>
          <p style={{ marginTop: '0.5rem', color: '#a6adb4' }}>
            The error has been logged. Nothing you generated was lost.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0 1rem',
              borderRadius: '0.625rem',
              border: 0,
              background: '#4ade9b',
              color: '#0b1a12',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
