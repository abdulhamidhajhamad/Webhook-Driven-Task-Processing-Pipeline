export const transformAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const result = { ...payload };

    const rename = config.rename as Record<string, string> | undefined;
    if (rename) {
      for (const [newKey, oldKey] of Object.entries(rename)) {
        if (oldKey in result) {
          result[newKey] = result[oldKey];
          delete result[oldKey];
        }
      }
    }

    const add = config.add as Record<string, unknown> | undefined;
    if (add) {
      for (const [key, value] of Object.entries(add)) {
        result[key] = value;
      }
    }

    const remove = config.remove as string[] | undefined;
    if (remove) {
      for (const key of remove) {
        delete result[key];
      }
    }

    return result;
  },
};