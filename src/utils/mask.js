export function maskSecret(value) {
  if (!value) return "";
  const text = String(value);
  if (text.length <= 8) return "*".repeat(text.length);
  const prefixLength = Math.min(8, Math.ceil(text.length / 4));
  const suffixLength = Math.min(4, Math.ceil(text.length / 5));
  return `${text.slice(0, prefixLength)}${"*".repeat(Math.max(8, text.length - prefixLength - suffixLength))}${text.slice(-suffixLength)}`;
}

export function redactLine(line) {
  return line.replace(/([A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|DATABASE_URL)[A-Z0-9_]*\s*[:=]\s*["']?)([^"'\s]+)/gi, (_match, prefix, value) => {
    return `${prefix}${maskSecret(value)}`;
  });
}
