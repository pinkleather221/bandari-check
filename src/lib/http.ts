export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status: number, detail: string) => json({ detail }, status);
