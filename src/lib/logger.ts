const isDev = process.env.NODE_ENV !== 'production';

export interface LogContext {
  org_id?: string | null;
  content_type?: string;
  content_id?: string;
  route?: string;
  [key: string]: unknown;
}

function fmt(level: string, msg: string, ctx?: LogContext): string {
  const ts = new Date().toISOString();
  const orgPart = ctx?.org_id ? ` [org:${ctx.org_id}]` : '';
  const ctxStr = ctx
    ? ` ${JSON.stringify(Object.fromEntries(Object.entries(ctx).filter(([k]) => k !== 'org_id')))}`
    : '';
  return `${ts} ${level}${orgPart} ${msg}${ctxStr}`;
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => {
    console.log(fmt('INFO ', msg, ctx));
  },
  warn: (msg: string, ctx?: LogContext) => {
    console.warn(fmt('WARN ', msg, ctx));
  },
  error: (msg: string, ctx?: LogContext) => {
    console.error(fmt('ERROR', msg, ctx));
  },
  debug: (msg: string, ctx?: LogContext) => {
    if (isDev) console.log(fmt('DEBUG', msg, ctx));
  },
};
