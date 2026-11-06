// Structured JSON logs. Never log tokens, passwords or request bodies.
const emit = (level, msg, meta) => {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...meta });
  (level === 'error' ? console.error : console.log)(line);
};
export const logger = {
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
};
