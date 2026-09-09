// Re-exports the exact same parsing/decision logic covered by Vitest at
// src/services/gmailIntegration.ts — deliberately not duplicated here, so the Edge
// Function and the test suite are always exercising identical code.
export * from '../../../src/services/gmailIntegration.ts';
