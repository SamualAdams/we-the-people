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

type CachedCredential = {
  expiresAt: number;
  token: string;
};

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;
let workspaceToken: CachedCredential | undefined;
let databaseCredential: CachedCredential | undefined;

const credentialRefreshSkewMs = 5 * 60 * 1000;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABRICKS_LAKEBASE_DATABASE_URL ||
    ""
  );
}

function getDatabricksHost() {
  return (process.env.DATABRICKS_HOST || "").replace(/\/+$/, "");
}

function getLakebaseEndpointName() {
  return (
    process.env.DATABRICKS_LAKEBASE_ENDPOINT_NAME ||
    process.env.ENDPOINT_NAME ||
    ""
  );
}

function hasServicePrincipalConfig() {
  return Boolean(
    getDatabricksHost() &&
      process.env.DATABRICKS_CLIENT_ID &&
      process.env.DATABRICKS_CLIENT_SECRET &&
      getLakebaseEndpointName(),
  );
}

function getDatabasePassword() {
  return (
    process.env.DATABASE_PASSWORD ||
    process.env.DATABRICKS_LAKEBASE_OAUTH_TOKEN ||
    ""
  );
}

function getParsedDatabaseUrl() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

function getPostgresHost() {
  return process.env.PGHOST || getParsedDatabaseUrl()?.hostname || "";
}

function getPostgresPort() {
  return Number(process.env.PGPORT || getParsedDatabaseUrl()?.port || 5432);
}

function getPostgresDatabase() {
  const parsedUrl = getParsedDatabaseUrl();
  return (
    process.env.PGDATABASE ||
    (parsedUrl?.pathname ? decodeURIComponent(parsedUrl.pathname.slice(1)) : "")
  );
}

function getPostgresUser() {
  return (
    process.env.PGUSER ||
    process.env.DATABRICKS_CLIENT_ID ||
    (getParsedDatabaseUrl()?.username
      ? decodeURIComponent(getParsedDatabaseUrl()?.username ?? "")
      : "")
  );
}

function isCredentialFresh(credential: CachedCredential | undefined) {
  return credential
    ? Date.now() < credential.expiresAt - credentialRefreshSkewMs
    : false;
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => null);
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

async function getWorkspaceToken() {
  if (isCredentialFresh(workspaceToken)) {
    return workspaceToken.token;
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID ?? "";
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET ?? "";
  const response = await fetch(`${getDatabricksHost()}/oidc/v1/token`, {
    body: "grant_type=client_credentials&scope=all-apis",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const payload = await readJson(response);

  if (!response.ok || typeof payload.access_token !== "string") {
    throw new Error("Databricks workspace OAuth token request failed.");
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  workspaceToken = {
    expiresAt: Date.now() + expiresIn * 1000,
    token: payload.access_token,
  };

  return workspaceToken.token;
}

async function getGeneratedDatabaseCredential() {
  if (isCredentialFresh(databaseCredential)) {
    return databaseCredential.token;
  }

  const token = await getWorkspaceToken();
  const response = await fetch(
    `${getDatabricksHost()}/api/2.0/postgres/credentials`,
    {
      body: JSON.stringify({ endpoint: getLakebaseEndpointName() }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = await readJson(response);

  if (!response.ok || typeof payload.token !== "string") {
    throw new Error("Databricks Lakebase database credential request failed.");
  }

  databaseCredential = {
    expiresAt:
      typeof payload.expire_time === "string"
        ? new Date(payload.expire_time).getTime()
        : Date.now() + 3600 * 1000,
    token: payload.token,
  };

  return databaseCredential.token;
}

async function resolveDatabasePassword() {
  if (hasServicePrincipalConfig()) {
    return getGeneratedDatabaseCredential();
  }

  return getDatabasePassword();
}

async function getPool() {
  const host = getPostgresHost();
  const database = getPostgresDatabase();
  const user = getPostgresUser();
  if (!host || !database || !user) {
    return null;
  }

  if (!pool) {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool({
      connectionTimeoutMillis: 5000,
      database,
      host,
      max: 2,
      password: resolveDatabasePassword,
      port: getPostgresPort(),
      ssl: { rejectUnauthorized: true },
      user,
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
