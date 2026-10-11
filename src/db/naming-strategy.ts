import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

/** camelCase (code) → snake_case (DB). Tên property khớp đặc tả docs/rules/09–12. */
export function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1_$2')
    .replace(/\./g, '_')
    .toLowerCase();
}

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(className: string, customName: string | undefined): string {
    return customName ?? toSnakeCase(className);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes.map(toSnakeCase).join('_');
    const base = customName ?? toSnakeCase(propertyName);
    return prefix ? `${prefix}_${base}` : base;
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
  ): string {
    return toSnakeCase(`${firstTableName}_${firstPropertyName}_${secondTableName}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(`${tableName}_${columnName ?? propertyName}`);
  }
}
