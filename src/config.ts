interface Config {
  port: number;
  nodeEnv: string;
  connectionString: string;
  jwtSecret: string;
  jwtExpiration: number;
}

const config: Config = {
  port: normalizePort(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  connectionString: getConnectionString(
    process.env.DB_CONNECTION_STRING || "",
    process.env.DB_USERNAME || "",
    process.env.DB_PASSWORD || ""
  ),
  jwtSecret: getJwtSecret(process.env.JWT_SECRET),
  jwtExpiration: normalizeJwtExpiration(process.env.JWT_EXPIRATION),
};

function normalizePort(port: any): number {
  const normalizedPort = parseInt(port);
  if (isNaN(normalizedPort) || normalizedPort < 0) return normalizedPort;
  return 3000;
}

function getConnectionString(
  connectionString: string,
  username: string,
  password: string
): string {
  const csParts = connectionString.split("://");
  if (csParts.length < 2) return "";
  return `${csParts[0]}://${username}:${encodeURIComponent(password)}@${
    csParts[1]
  }`;
}

function getJwtSecret(secret: string | undefined): string {
  if (!secret) throw new Error("JWT secret key is not set.");
  return secret;
}

function normalizeJwtExpiration(expiration: string | undefined): number {
  const defaultExpiration = 3600;
  if (expiration === undefined) return defaultExpiration;
  const normalized = parseInt(expiration);
  if (isNaN(normalized)) {
    return defaultExpiration;
  }
  return normalized;
}

export default config;
