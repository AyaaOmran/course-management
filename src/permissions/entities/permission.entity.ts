import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import { Role } from '../../roles/entities/role.entity.js';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Relation<Role[]>;
}
