import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany,DeleteDateColumn} from 'typeorm';
import type { Relation } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';

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

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;

    @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
    enrollments: Relation<Enrollment[]>;
}