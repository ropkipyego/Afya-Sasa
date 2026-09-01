import { KENYA_LAB_DEPARTMENTS, KENYA_LAB_SPECIMENS } from './kenya-lab-catalog.foundation';
import { KENYA_LAB_PANELS } from './kenya-lab-catalog.panels';
import { JALARAM_ORDERABLE_TESTS } from './jalaram-orderable-tests.seed';
import type { SeedOrderableTest } from '../lab-catalog.types';

function dedupeTests(tests: SeedOrderableTest[]): SeedOrderableTest[] {
  const byCode = new Map<string, SeedOrderableTest>();
  for (const test of tests) {
    if (!byCode.has(test.code)) byCode.set(test.code, test);
  }
  return [...byCode.values()];
}

export const KENYA_LAB_CATALOG = {
  departments: KENYA_LAB_DEPARTMENTS,
  specimens: KENYA_LAB_SPECIMENS,
  orderableTests: dedupeTests([...KENYA_LAB_PANELS, ...JALARAM_ORDERABLE_TESTS]),
};

export { KENYA_LAB_DEPARTMENTS, KENYA_LAB_SPECIMENS, KENYA_LAB_PANELS, JALARAM_ORDERABLE_TESTS };
