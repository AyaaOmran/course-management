import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn} from 'typeorm';

@Entity('admins')
export class Admin{
    @PrimaryGeneratedColumn()
    id:number

    @Column()
    name:string

    @Column({unique:true})
    email:string

    @CreateDateColumn()
    createdAt: Date;
}