import { z } from 'zod';

const envSchema = z.object({
  READ_AI_API_KEY: z.string().trim().min(1),
  READ_AI_WEBHOOK_SECRET: z.string().trim().min(1),
  CLICKUP_API_KEY: z.string().trim().min(1),
  CLICKUP_TEAM_ID: z.string().trim().min(1),
  ANTHROPIC_API_KEY: z.string().trim().min(1),
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().trim().min(1),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // During Next.js build phase, env vars are not available — skip validation.
  // At runtime (serverless function invocation) NEXT_PHASE is not set and
  // validation runs normally, failing fast if any var is missing or malformed.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return {} as Env;
  }

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Environment variable validation failed:\n  ${messages}`);
  }
  return result.data;
}

export const env = validateEnv();
