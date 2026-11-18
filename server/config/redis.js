// REDIS_URL (e.g. rediss://default:pass@host:6379) in production, localhost otherwise.
function fromUrl(value) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export const connection = process.env.REDIS_URL
  ? fromUrl(process.env.REDIS_URL)
  : { host: "localhost", port: 6379 };
