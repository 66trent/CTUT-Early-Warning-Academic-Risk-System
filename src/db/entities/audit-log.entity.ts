import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Nhật ký kiểm toán — append-only (docs/rules/06, 11). Không có đường UPDATE/DELETE ở ứng dụng.
 * Ghi duy nhất qua `writeAuditLog()` trong src/lib/audit.ts.
 */
@Entity('audit_logs')
@Index(['actorId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** NULL với sự kiện chưa xác định người dùng (VD: đăng nhập thất bại với email lạ). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  actorId!: string | null;

  /** Kiểu TS `AuditAction` (union + Zod), lưu varchar — xem src/lib/audit.ts. */
  @Column({ type: 'varchar', length: 60 })
  action!: string;

  @Column({ type: 'varchar', length: 40 })
  targetType!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  detail!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
