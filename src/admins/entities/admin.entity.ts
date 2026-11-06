import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,  ManyToOne, JoinColumn, RelationId,} from 'typeorm';
import type { Relation } from 'typeorm';
import { Role } from '../../roles/entities/role.entity.js';
@Entity('admins')
export class Admin{
    @PrimaryGeneratedColumn()
    id:number

    @Column()
    name:string

    @Column({unique:true})
    email:string
  
    @Column({ select: false })
    password: string;

    @Column({ type: 'varchar', nullable: true, select: false })
    refreshToken: string | null;

    @ManyToOne(() => Role, { nullable: false })
    @JoinColumn({ name: 'roleId' })
    role: Relation<Role>;

    @RelationId((admin: Admin) => admin.role)
    roleId: number;    

    @CreateDateColumn()
    createdAt: Date;
}