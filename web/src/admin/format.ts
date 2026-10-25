import { strings } from '../strings';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : strings.genericError;
}
