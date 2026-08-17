import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    NotFoundException,
  } from '@nestjs/common';
  import { ReviewService } from './review.service';
  import { Review } from './review.entity';
  
  @Controller('reviews')
  export class ReviewController {
    constructor(private readonly service: ReviewService) {}
  
    @Get()
    findAll(): Promise<Review[]> {
      return this.service.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Review> {
      const review = await this.service.findOne(id);
      if (!review) throw new NotFoundException('Review not found');
      return review;
    }
  
    @Post()
    create(@Body() data: Partial<Review>) {
      return this.service.create(data);
    }
  
    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Review>) {
      return this.service.update(id, data);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.service.remove(id);
    }
  }
  