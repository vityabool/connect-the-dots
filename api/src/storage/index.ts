import { AzureTables } from './azureTables';
import type { Tables } from './tables';

let instance: Tables | undefined;

/** The Table Storage connection used by the running Functions app (created lazily). */
export function getTables(): Tables {
  if (!instance) {
    const connectionString = process.env.TABLES_CONNECTION_STRING;
    if (!connectionString) throw new Error('TABLES_CONNECTION_STRING is not configured');
    instance = new AzureTables(connectionString);
  }
  return instance;
}
