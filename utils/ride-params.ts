const getParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export function parseStringParam(value?: string | string[]) {
  return getParam(value) || "";
}

export function parseNumberParam(value?: string | string[]) {
  const parsed = Number(getParam(value));

  return Number.isFinite(parsed) ? parsed : null;
}
