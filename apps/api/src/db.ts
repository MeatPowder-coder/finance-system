import { Pool, type PoolClient, type QueryResultRow } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export function maxPlaceholderIndex(text: string) {
  let max = 0;
  for (const match of text.matchAll(/\$(\d+)/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function assertSqlParameterCount(text: string, params: unknown[]) {
  const expected = maxPlaceholderIndex(text);
  if (expected !== params.length) {
    const compactSql = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`SQL parameter mismatch: expected ${expected}, received ${params.length}. Query: ${compactSql}`);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  assertSqlParameterCount(text, params);
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  const guardedClient = new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "query") return Reflect.get(target, property, receiver);
      return ((text: string, params: unknown[] = []) => {
        assertSqlParameterCount(text, params);
        return target.query(text, params as any);
      }) as PoolClient["query"];
    },
  });
  try {
    await client.query("BEGIN");
    const result = await work(guardedClient);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
