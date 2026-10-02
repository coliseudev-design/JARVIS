// F01 has no authenticated product actor or external executor.
// This explicit gate must be replaced by reviewed scoped authorization in F02/F08.
export function productExecutionPolicy(): { allowed: false; reason: 'IDENTITY_NOT_IMPLEMENTED' } {
  return { allowed: false, reason: 'IDENTITY_NOT_IMPLEMENTED' };
}
