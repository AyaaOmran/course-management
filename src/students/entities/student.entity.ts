import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,DeleteDateColumn,  ManyToOne, JoinColumn, RelationId,} from 'typeorm';
import type { Relation } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';
import { Role } from '../../roles/entities/role.entity.js';
@Entity('students')
export class Student{
    @PrimaryGeneratedColumn()
    id:number

    @Column()
    name:string

    @Column({unique:true})
    email:string

    @Column()
    phone: string;

    @Column({ select: false })
    password: string;

    @Column({ type: 'varchar', nullable: true, select: false })
    refreshToken: string | null;

    @ManyToOne(() => Role, { nullable: false })
    @JoinColumn({ name: 'roleId' })
    role: Relation<Role>;

    @RelationId((student: Student) => student.role)
    roleId: number;    

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;

    @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
    enrollments: Relation<Enrollment[]>;
}