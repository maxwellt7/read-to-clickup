// scripts/setup-clickup.ts
import 'dotenv/config';

// Set env vars before any lib imports to pass validation
process.env.READ_AI_API_KEY = process.env.READ_AI_API_KEY ?? 'placeholder';
process.env.READ_AI_WEBHOOK_SECRET = process.env.READ_AI_WEBHOOK_SECRET ?? 'placeholder';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'placeholder';
process.env.KV_REST_API_URL = process.env.KV_REST_API_URL ?? 'https://placeholder.example.com';
process.env.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN ?? 'placeholder';

import { findOrCreateFolder, findOrCreateList } from '../src/lib/clickup/setup';
import { getListCustomFields, createCustomField } from '../src/lib/clickup/client';
import { CALL_TYPE_ROUTES } from '../src/lib/clickup/router';

const CUSTOM_FIELDS = [
  { name: 'Meeting Date', type: 'date' },
  {
    name: 'Call Type',
    type: 'drop_down',
    typeConfig: {
      options: [
        { name: 'leadership', orderindex: 0, color: '#6c5ce7' },
        { name: 'sales', orderindex: 1, color: '#00b894' },
        { name: 'operations', orderindex: 2, color: '#0984e3' },
        { name: 'creative', orderindex: 3, color: '#fd79a8' },
        { name: 'admin', orderindex: 4, color: '#636e72' },
        { name: 'hr', orderindex: 5, color: '#fdcb6e' },
        { name: 'client', orderindex: 6, color: '#e17055' },
        { name: 'general', orderindex: 7, color: '#b2bec3' },
      ],
    },
  },
  { name: 'Read.ai Link', type: 'url' },
  { name: 'Duration (min)', type: 'number' },
  {
    name: 'Sentiment',
    type: 'drop_down',
    typeConfig: {
      options: [
        { name: 'positive', orderindex: 0, color: '#00b894' },
        { name: 'neutral', orderindex: 1, color: '#636e72' },
        { name: 'negative', orderindex: 2, color: '#d63031' },
        { name: 'mixed', orderindex: 3, color: '#fdcb6e' },
      ],
    },
  },
  { name: 'AI Confidence', type: 'number' },
];

async function addMissingCustomFields(listId: string): Promise<void> {
  const { fields: existing } = await getListCustomFields(listId);
  const existingNames = new Set(existing.map((f) => f.name));

  for (const field of CUSTOM_FIELDS) {
    if (existingNames.has(field.name)) {
      console.log(`  ✓ Custom field "${field.name}" already exists`);
      continue;
    }
    await createCustomField(listId, field.name, field.type, field.typeConfig);
    console.log(`  + Created custom field "${field.name}"`);
  }
}

async function main() {
  if (!process.env.CLICKUP_API_KEY || process.env.CLICKUP_API_KEY === 'placeholder') {
    console.error('ERROR: CLICKUP_API_KEY is not set. Create a .env.local file with your real values.');
    process.exit(1);
  }

  console.log('Setting up ClickUp workspace for Read.ai sync...\n');

  for (const [callType, route] of Object.entries(CALL_TYPE_ROUTES)) {
    console.log(`\n[${callType}] Space ${route.spaceId}`);
    console.log(`   Folder: "${route.folderName}"`);
    console.log(`   List:   "${route.listName}"`);

    const folderId = await findOrCreateFolder(route.spaceId, route.folderName);
    const listId = await findOrCreateList(folderId, route.listName);

    console.log(`   Adding custom fields to list ${listId}...`);
    await addMissingCustomFields(listId);
  }

  // Also set up fallback Needs Review list
  console.log('\n[fallback] GROWTHGOD space (low-confidence / needs review)');
  const fallbackFolderId = await findOrCreateFolder('901312664037', 'Meeting Notes');
  await findOrCreateList(fallbackFolderId, 'Needs Review');

  console.log('\nClickUp workspace setup complete!');
  console.log('\nNext steps:');
  console.log('1. Deploy to Vercel: vercel --prod');
  console.log('2. Register webhook URL in Read.ai settings:');
  console.log('   https://your-app.vercel.app/api/webhook/read-ai');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
