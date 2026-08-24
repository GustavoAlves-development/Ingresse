export function getAppUrl(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return appUrl.replace(/\/+$/, "");
}
