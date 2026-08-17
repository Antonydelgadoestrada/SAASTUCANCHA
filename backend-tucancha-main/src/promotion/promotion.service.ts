import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './promotion.entity';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
  ) {}

  findAll() {
    return this.promotionRepository.find();
  }

  findOne(id: string) {
    return this.promotionRepository.findOne({ where: { id } });
  }

  create(data: Partial<Promotion>) {
    const promotion = this.promotionRepository.create(data);
    return this.promotionRepository.save(promotion);
  }

  async update(id: string, data: Partial<Promotion>) {
    await this.promotionRepository.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.promotionRepository.delete(id);
  }
}
