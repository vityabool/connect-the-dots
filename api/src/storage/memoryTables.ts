import { ConflictError, type Entity, type TableName, type Tables } from './tables';

/** In-memory Tables implementation for unit tests and quick local experiments. */
export class MemoryTables implements Tables {
  private readonly data = new Map<string, Map<string, Entity>>();

  private partition(table: TableName, partitionKey: string): Map<string, Entity> {
    const key = `${table}|${partitionKey}`;
    let rows = this.data.get(key);
    if (!rows) {
      rows = new Map();
      this.data.set(key, rows);
    }
    return rows;
  }

  async insert(table: TableName, entity: Entity): Promise<void> {
    const rows = this.partition(table, entity.partitionKey);
    if (rows.has(entity.rowKey)) throw new ConflictError();
    rows.set(entity.rowKey, { ...entity });
  }

  async get(table: TableName, partitionKey: string, rowKey: string): Promise<Entity | undefined> {
    const row = this.partition(table, partitionKey).get(rowKey);
    return row ? { ...row } : undefined;
  }

  async upsert(table: TableName, entity: Entity): Promise<void> {
    this.partition(table, entity.partitionKey).set(entity.rowKey, { ...entity });
  }

  async merge(table: TableName, entity: Entity): Promise<void> {
    const rows = this.partition(table, entity.partitionKey);
    const current = rows.get(entity.rowKey);
    if (!current) throw new Error('Cannot merge into a row that does not exist');
    rows.set(entity.rowKey, { ...current, ...entity });
  }

  async delete(table: TableName, partitionKey: string, rowKey: string): Promise<void> {
    this.partition(table, partitionKey).delete(rowKey);
  }

  async list(table: TableName, partitionKey: string): Promise<Entity[]> {
    return [...this.partition(table, partitionKey).values()].map((row) => ({ ...row }));
  }

  async scan(table: TableName): Promise<Entity[]> {
    const rows: Entity[] = [];
    for (const [key, partition] of this.data) {
      if (key.startsWith(`${table}|`)) for (const row of partition.values()) rows.push({ ...row });
    }
    return rows;
  }

  async deletePartition(table: TableName, partitionKey: string): Promise<void> {
    this.data.delete(`${table}|${partitionKey}`);
  }
}
