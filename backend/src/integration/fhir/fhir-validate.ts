export type ValidationIssue = {
  severity: 'error' | 'warning';
  path: string;
  message: string;
};

export function validateMappedResource(resource: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];
  const type = String(resource.resourceType ?? '');
  const gaps = Array.isArray(resource._mappingGaps)
    ? (resource._mappingGaps as string[])
    : [];
  for (const gap of gaps) {
    issues.push({ severity: 'error', path: gap, message: `Required or expected element is unmapped: ${gap}` });
  }
  if (type === 'Patient') {
    const identifier = resource.identifier as Array<{ value?: string }> | undefined;
    if (!identifier?.some((row) => row.value)) {
      issues.push({ severity: 'error', path: 'Patient.identifier', message: 'At least one identifier is required' });
    }
    const name = resource.name as Array<{ family?: string; given?: unknown[] }> | undefined;
    if (!name?.[0]?.family) {
      issues.push({ severity: 'error', path: 'Patient.name.family', message: 'Family name is required' });
    }
    if (!resource.gender) {
      issues.push({ severity: 'error', path: 'Patient.gender', message: 'Gender is required' });
    }
    if (!resource.birthDate) {
      issues.push({ severity: 'error', path: 'Patient.birthDate', message: 'birthDate is required' });
    }
  }
  if (type === 'Encounter' && !resource.subject) {
    issues.push({ severity: 'error', path: 'Encounter.subject', message: 'Encounter.subject is required' });
  }
  return {
    resourceType: type,
    valid: issues.filter((issue) => issue.severity === 'error').length === 0,
    issues,
  };
}
