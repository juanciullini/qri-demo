import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // COELSA
  COELSA_MODE: z.enum(['sandbox', 'production']).default('sandbox'),
  COELSA_BASE_URL: z.string().url().optional(),
  COELSA_AUTH_URL: z.string().url().optional(),
  COELSA_CVU_URL: z.string().url().optional(),
  COELSA_CERT_PATH: z.string().optional(),
  COELSA_KEY_PATH: z.string().optional(),
  COELSA_CA_PATH: z.string().optional(),
  COELSA_DEBIN_USERNAME: z.string().optional(),
  COELSA_DEBIN_PASSWORD: z.string().optional(),
  COELSA_DEBIN_ID: z.string().optional(),
  COELSA_DEBIN_SECRET: z.string().optional(),
  COELSA_CVU_USERNAME: z.string().optional(),
  COELSA_CVU_PASSWORD: z.string().optional(),
  COELSA_CVU_ID: z.string().optional(),
  COELSA_CVU_SECRET: z.string().optional(),

  // PSP
  PSP_CUIT: z.string().length(11),
  PSP_REVERSE_DOMAIN: z.string().default('app.qri'),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Wallet
  COELSA_BILLETERA_ID: z.coerce.number().default(0),

  // Sandbox
  SANDBOX_DEFAULT_SCENARIO: z.string().default('happy_path'),
  SANDBOX_DELAY_MS: z.coerce.number().default(0),
}).refine(
  (data) => {
    if (data.COELSA_MODE === 'production') {
      return !!(data.COELSA_BASE_URL && data.COELSA_AUTH_URL && data.COELSA_CERT_PATH && data.COELSA_KEY_PATH && data.COELSA_CA_PATH);
    }
    return true;
  },
  { message: 'COELSA production mode requires BASE_URL, AUTH_URL, CERT_PATH, KEY_PATH, and CA_PATH' }
);

function loadEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
