export const enrichAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = config.url as string;
    const targetField = (config.targetField as string) ?? 'enriched';

    const resolvedUrl = url.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => String(payload[key] ?? '')
    );

    const response = await fetch(resolvedUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Enrich fetch failed with status ${response.status}`);
    }

    const data = await response.json();

    return { ...payload, [targetField]: data };
  },
};