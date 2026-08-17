import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  findAll() {
    return this.reviewRepo.find({ relations: ['user', 'booking', 'club', 'court'] });
  }

  findOne(id: string) {
    return this.reviewRepo.findOne({ where: { id }, relations: ['user', 'booking', 'club', 'court'] });
  }

  create(data: Partial<Review>) {
    const review = this.reviewRepo.create(data);
    return this.reviewRepo.save(review);
  }

  async update(id: string, data: Partial<Review>) {
    await this.reviewRepo.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.reviewRepo.delete(id);
  }
}
