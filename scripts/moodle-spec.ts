/**
 * `npm run moodle:spec` — ghi lại docs/demo-data/moodle/moodle-demo.json (bản trong repo, ngày chốt
 * FIXTURE_CUTOFF) từ scripts/lib/moodle-demo-spec.ts. Dựng Moodle demo thật dùng `npm run moodle:setup`
 * (sinh bản theo ngày chốt hôm qua vào moodle-demo.local.json, không commit).
 */
import { writeFileSync } from 'node:fs';
import { buildMoodleDemoSpec, FIXTURE_CUTOFF } from './lib/moodle-demo-spec';

const out = 'docs/demo-data/moodle/moodle-demo.json';
writeFileSync(out, `${JSON.stringify(buildMoodleDemoSpec(FIXTURE_CUTOFF), null, 2)}\n`);
process.stdout.write(`✔ ${out} (ngày chốt ${FIXTURE_CUTOFF})\n`);
