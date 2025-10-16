interface Config {
  port: number;
  nodeEnv: string;
  connectionString: string;
}

const config: Config = {
  port: normalizePort(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  connectionString: getConnectionString(
    process.env.DB_CONNECTION_STRING || "",
    process.env.DB_USERNAME || "",
    process.env.DB_PASSWORD || ""
  ),
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

export default config;
