/** Names of the Azure Tables used by the app (created by infra/main.bicep). */
export type TableName =
  | 'Games'
  | 'GameCodes'
  | 'OwnerGames'
  | 'Participants'
  | 'Topics'
  | 'Connections'
  | 'RateLimits';

export type EntityValue = string | number | boolean;

export interface Entity {
  partitionKey: string;
  rowKey: string;
  [property: string]: EntityValue;
}

/** Thrown by `insert` when a row with the same keys already exists. */
export class ConflictError extends Error {
  constructor(message = 'Entity already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * The small slice of Table Storage the app needs. The production implementation talks to Azure
 * (azureTables.ts); tests use an in-memory implementation (memoryTables.ts).
 */
export interface Tables {
  /** Inserts a new row. Throws ConflictError when the row exists. */
  insert(table: TableName, entity: Entity): Promise<void>;
  get(table: TableName, partitionKey: string, rowKey: string): Promise<Entity | undefined>;
  /** Inserts or fully replaces a row. */
  upsert(table: TableName, entity: Entity): Promise<void>;
  /** Updates only the given properties of an existing row, leaving all other properties untouched. */
  merge(table: TableName, entity: Entity): Promise<void>;
  /** Deletes a row; silently succeeds when it does not exist. */
  delete(table: TableName, partitionKey: string, rowKey: string): Promise<void>;
  /** All rows of one partition. */
  list(table: TableName, partitionKey: string): Promise<Entity[]>;
  /** Every row of a table (used by maintenance jobs; the tables are small). */
  scan(table: TableName): Promise<Entity[]>;
  /** Deletes every row of one partition. */
  deletePartition(table: TableName, partitionKey: string): Promise<void>;
}
