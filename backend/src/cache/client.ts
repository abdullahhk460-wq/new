// Redis is disabled in local dev — all cache operations are safe no-ops.
// To enable, install Redis, set REDIS_URL in .env, and restore the real client.

export const cache = {
  async get(_key: string): Promise<string | null> {
    return null;
  },
  async set(_key: string, _value: string, _ttlSeconds?: number): Promise<boolean> {
    return false;
  },
  async del(_key: string): Promise<boolean> {
    return false;
  },
  async flush(): Promise<boolean> {
    return false;
  },
  client: null,
};

export default cache;
