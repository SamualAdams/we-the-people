import type { Pool } from "pg";

export type ExplainExchange = {
  assistantMessage: string;
  pagePath: string;
  selectedText: string;
  threadId: string;
  userMessage: string;
};

type SaveResult = {
  persisted: boolean;
  threadId: string;
};

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABRICKS_LAKEBASE_DATABASE_URL ||
    ""
  );
}

function getDatabasePassword() {
  return (
    process.env.DATABASE_PASSWORD ||
    process.env.DATABRICKS_LAKEBASE_OAUTH_TOKEN ||
    ""
  );
}

async function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool({
      connectionString,
      connectionTimeoutMillis: 2500,
      max: 2,
      password: getDatabasePassword() || undefined,
      ssl: { rejectUnauthorized: true },
    });
  }

  return pool;
}

async function ensureSchema(activePool: Pool) {
  schemaReady ??= (async () => {
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS civic_explain_threads (
        id TEXT PRIMARY KEY,
        selected_text TEXT NOT NULL DEFAULT '',
        page_path TEXT NOT NULL DEFAULT '/',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await activePool.query(`
      CREATE TABLE IF NOT EXISTS civic_explain_messages (
        id BIGSERIAL PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES civic_explain_threads(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await activePool.query(`
      CREATE INDEX IF NOT EXISTS civic_explain_messages_thread_id_idx
      ON civic_explain_messages (thread_id, created_at)
    `);
  })();

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = undefined;
    throw error;
  }
}

export async function saveExplanationExchange({
  assistantMessage,
  pagePath,
  selectedText,
  threadId,
  userMessage,
}: ExplainExchange): Promise<SaveResult> {
  const activePool = await getPool();
  if (!activePool) {
    return { persisted: false, threadId };
  }

  await ensureSchema(activePool);

  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO civic_explain_threads (id, selected_text, page_path)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          selected_text = EXCLUDED.selected_text,
          page_path = EXCLUDED.page_path,
          updated_at = now()
      `,
      [threadId, selectedText, pagePath || "/"],
    );
    await client.query(
      `
        INSERT INTO civic_explain_messages (thread_id, role, content)
        VALUES ($1, 'user', $2), ($1, 'assistant', $3)
      `,
      [threadId, userMessage, assistantMessage],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { persisted: true, threadId };
}
