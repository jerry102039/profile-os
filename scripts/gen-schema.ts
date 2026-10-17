// 從 src/profile/schema.ts 產生 profile.schema.json，給 VS Code（YAML 擴充）做自動完成與即時檢查。
// 用法：npm run schema
import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProfileSchema } from '../src/profile/schema';

const schema = zodToJsonSchema(ProfileSchema, { name: 'Profile', $refStrategy: 'none' });
writeFileSync(new URL('../profile.schema.json', import.meta.url), JSON.stringify(schema, null, 2) + '\n');
console.log('wrote profile.schema.json');
