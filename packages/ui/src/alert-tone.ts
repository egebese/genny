/**
 * The four things a notice can be.
 *
 * Its own module so both the component and the plain-TypeScript toast policy can
 * name it without one importing the other's JSX.
 */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger'
