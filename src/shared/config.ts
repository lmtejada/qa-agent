import { z } from "zod";

// Keep in sync with .env.example.
function createEnvSchema() {
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    APP_NAME: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default("127.0.0.1"),
  });
}

export type Config = Readonly<z.infer<ReturnType<typeof createEnvSchema>>>;

// Real environment variables take precedence over .env, and in production the platform
// usually injects them, so a missing file is not an error.
function loadEnvFileIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const result = createEnvSchema().safeParse(env);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${problems}\n\nSee .env.example for the expected variables.`,
    );
  }

  return Object.freeze(result.data);
}

export function loadConfig(): Config {
  loadEnvFileIfPresent();
  return parseConfig(process.env);
}
