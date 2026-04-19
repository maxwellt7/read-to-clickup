import { z } from 'zod';

const envSchema = z.object({
  READ_AI_API_KEY: z.string().min(1),
  READ_AI_WEBHOOK_SECRET: z.string().min(1),
  CLICKUP_API_KEY: z.string().min(1),
  CLICKUP_TEAM_ID: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing required environment variables: ${missing}`);
  }
  return result.data;
}

export const env = validateEnv();
