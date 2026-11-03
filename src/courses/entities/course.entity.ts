import { Column, Entity, PrimaryGeneratedColumn ,CreateDateColumn,OneToMany,DeleteDateColumn} from "typeorm";
import type { Relation } from 'typeorm';
import { Enrollment } from '../../enrollments/entities/enrollment.entity.js';

export enum DiscountType {
  NONE = 'NONE',
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

const numericTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity('courses')
export class Course{
    @PrimaryGeneratedColumn()
    id:number

    @Column()
    title:string

    @Column()
    description:string

    @Column({
        type:'numeric',
        precision:10,
        scale:2,
        transformer:numericTransformer,
    })
    price:number;

    @Column({
        type:'enum',
        enum:DiscountType,
        default:DiscountType.NONE,
    })
    discountType:DiscountType;

    @Column({
        type:'numeric',
        precision: 10,
        scale:2,
        default:0,
        transformer:numericTransformer,
    })
    discountValue:number;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deletedAt: Date | null;

    @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
    enrollments: Relation<Enrollment[]>;

}