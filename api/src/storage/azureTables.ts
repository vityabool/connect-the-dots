import { odata, RestError, TableClient, type TableEntityResult } from '@azure/data-tables';
import { ConflictError, type Entity, type EntityValue, type TableName, type Tables } from './tables';

/** Table Storage allows at most 100 operations per transaction, all in the same partition. */
const TRANSACTION_LIMIT = 100;

function toEntity(result: TableEntityResult<Record<string, unknown>>): Entity {
  const entity: Entity = { partitionKey: result.partitionKey ?? '', rowKey: result.rowKey ?? '' };
  for (const [key, value] of Object.entries(result)) {
    if (key === 'partitionKey' || key === 'rowKey' || key === 'etag' || key === 'timestamp') continue;
    if (key.startsWith('odata.')) continue; // service metadata, not data
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      entity[key] = value as EntityValue;
    }
  }
  return entity;
}

function statusOf(error: unknown): number | undefined {
  return error instanceof RestError ? error.statusCode : undefined;
}

export class AzureTables implements Tables {
  private readonly clients = new Map<TableName, TableClient>();

  constructor(private readonly connectionString: string) {}

  private client(table: TableName): TableClient {
    let client = this.clients.get(table);
    if (!client) {
      client = TableClient.fromConnectionString(this.connectionString, table, {
        allowInsecureConnection: this.connectionString.includes('UseDevelopmentStorage=true'),
      });
      this.clients.set(table, client);
    }
    return client;
  }

  async insert(table: TableName, entity: Entity): Promise<void> {
    try {
      await this.client(table).createEntity(entity);
    } catch (error) {
      if (statusOf(error) === 409) throw new ConflictError();
      throw error;
    }
  }

  async get(table: TableName, partitionKey: string, rowKey: string): Promise<Entity | undefined> {
    try {
      const result = await this.client(table).getEntity<Record<string, unknown>>(partitionKey, rowKey);
      return toEntity(result);
    } catch (error) {
      if (statusOf(error) === 404) return undefined;
      throw error;
    }
  }

  async upsert(table: TableName, entity: Entity): Promise<void> {
    await this.client(table).upsertEntity(entity, 'Replace');
  }

  async merge(table: TableName, entity: Entity): Promise<void> {
    await this.client(table).updateEntity(entity, 'Merge');
  }

  async delete(table: TableName, partitionKey: string, rowKey: string): Promise<void> {
    try {
      await this.client(table).deleteEntity(partitionKey, rowKey);
    } catch (error) {
      if (statusOf(error) === 404) return;
      throw error;
    }
  }

  async list(table: TableName, partitionKey: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    const iterator = this.client(table).listEntities<Record<string, unknown>>({
      queryOptions: { filter: odata`PartitionKey eq ${partitionKey}` },
    });
    for await (const result of iterator) entities.push(toEntity(result));
    return entities;
  }

  async scan(table: TableName): Promise<Entity[]> {
    const entities: Entity[] = [];
    for await (const result of this.client(table).listEntities<Record<string, unknown>>()) entities.push(toEntity(result));
    return entities;
  }

  async deletePartition(table: TableName, partitionKey: string): Promise<void> {
    const rows = await this.list(table, partitionKey);
    const client = this.client(table);
    for (let start = 0; start < rows.length; start += TRANSACTION_LIMIT) {
      const chunk = rows.slice(start, start + TRANSACTION_LIMIT);
      await client.submitTransaction(
        chunk.map((row) => ['delete', { partitionKey: row.partitionKey, rowKey: row.rowKey }] as const),
      );
    }
  }
}
