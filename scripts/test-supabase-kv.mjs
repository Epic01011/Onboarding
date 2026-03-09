const baseUrl = process.env.KV_API_URL || 'http://localhost:3000/api/supabase-kv';
const token = process.env.SUPABASE_TEST_ACCESS_TOKEN || '';
const userId = process.env.SUPABASE_TEST_USER_ID || '';

if (!token || !userId) {
  console.error('Missing env vars: SUPABASE_TEST_ACCESS_TOKEN and SUPABASE_TEST_USER_ID');
  console.error('Example:');
  console.error('  $env:SUPABASE_TEST_ACCESS_TOKEN="..."');
  console.error('  $env:SUPABASE_TEST_USER_ID="..."');
  console.error('  pnpm run supabase:kv:test');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

const key = `smoke:${userId}:` + Date.now();
const value = {
  ok: true,
  at: new Date().toISOString(),
  source: 'supabase-kv-test',
};

async function call(body) {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, ok: response.ok, payload };
}

(async () => {
  try {
    const setRes = await call({ op: 'set', key, value, userId });
    if (!setRes.ok) {
      console.error('[SET] failed', setRes.status, setRes.payload);
      process.exit(1);
    }

    const getRes = await call({ op: 'get', key, userId });
    if (!getRes.ok) {
      console.error('[GET] failed', getRes.status, getRes.payload);
      process.exit(1);
    }

    const returned = getRes.payload?.value;
    const pass = returned && returned.ok === true && returned.source === 'supabase-kv-test';
    if (!pass) {
      console.error('[ASSERT] unexpected value', returned);
      process.exit(1);
    }

    console.log('KV E2E OK');
    console.log(JSON.stringify({ key, value: returned }, null, 2));
  } catch (err) {
    console.error('KV E2E ERROR', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
