import { Redis } from "@upstash/redis";
import { RedisStore, type RedisReply } from "rate-limit-redis";

import { env } from "../../config/env.js";

type RedisReplyValue = boolean | number | string;
type UpstashRateLimitRedis = Pick<
  Redis,
  "decr" | "del" | "evalsha" | "scriptLoad"
>;

let redis: Redis | null = null;

export const createUpstashRateLimitStore = (prefix: string) =>
  new RedisStore({
    prefix,
    sendCommand: (...command) =>
      sendUpstashRateLimitCommand(getUpstashRedis(), command)
  });

export const checkUpstashRedisReady = async () => {
  const response = await getUpstashRedis().ping();

  if (response !== "PONG") {
    throw new Error("Redis readiness check returned an unexpected response.");
  }
};

export const sendUpstashRateLimitCommand = async (
  client: UpstashRateLimitRedis,
  [rawCommand, ...args]: string[]
): Promise<RedisReply> => {
  // Keep this adapter limited to the raw commands rate-limit-redis needs.
  const command = rawCommand?.toUpperCase();

  if (command === "SCRIPT") {
    return loadScript(client, args);
  }

  if (command === "EVALSHA") {
    return toRedisReply(await evalSha(client, args));
  }

  if (command === "DECR") {
    const [key] = args;

    if (!key) {
      throw new Error("DECR requires a key.");
    }

    return client.decr(key);
  }

  if (command === "DEL") {
    if (args.length === 0) {
      throw new Error("DEL requires at least one key.");
    }

    return client.del(...args);
  }

  throw new Error(`Unsupported rate-limit Redis command: ${rawCommand}`);
};

const getUpstashRedis = () => {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      keepAlive: true
    });
  }

  return redis;
};

const loadScript = (client: UpstashRateLimitRedis, args: string[]) => {
  const [subcommand, script] = args;

  if (subcommand?.toUpperCase() !== "LOAD" || !script) {
    throw new Error("Only SCRIPT LOAD is supported for rate limiting.");
  }

  return client.scriptLoad(script);
};

const evalSha = (client: UpstashRateLimitRedis, args: string[]) => {
  const [sha, rawKeyCount, ...keysAndArgs] = args;
  const keyCount = Number.parseInt(rawKeyCount ?? "", 10);

  if (!sha || !Number.isInteger(keyCount) || keyCount < 0) {
    throw new Error("EVALSHA requires a script SHA and key count.");
  }

  const keys = keysAndArgs.slice(0, keyCount);
  const scriptArgs = keysAndArgs.slice(keyCount);

  if (keys.length !== keyCount) {
    throw new Error("EVALSHA key count does not match provided keys.");
  }

  return client.evalsha(sha, keys, scriptArgs);
};

const toRedisReply = (reply: unknown): RedisReply => {
  if (isRedisReplyValue(reply)) {
    return reply;
  }

  if (Array.isArray(reply) && reply.every(isRedisReplyValue)) {
    return reply;
  }

  throw new Error("Unsupported Upstash Redis reply for rate limiting.");
};

const isRedisReplyValue = (value: unknown): value is RedisReplyValue =>
  typeof value === "boolean" ||
  typeof value === "number" ||
  typeof value === "string";
