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
  import { PromotionService } from './promotion.service';
  import { Promotion } from './promotion.entity';
  
  @Controller('promotions')
  export class PromotionController {
    constructor(private readonly promotionService: PromotionService) {}
  
    @Get()
    findAll(): Promise<Promotion[]> {
      return this.promotionService.findAll();
    }
  
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Promotion> {
      const promotion = await this.promotionService.findOne(id);
      if (!promotion) {
        throw new NotFoundException('Promotion not found');
      }
      return promotion;
    }
  
    @Post()
    create(@Body() data: Partial<Promotion>): Promise<Promotion> {
      return this.promotionService.create(data);
    }
  
    @Put(':id')
    update(
      @Param('id') id: string,
      @Body() data: Partial<Promotion>,
    ): Promise<Promotion> {
      return this.promotionService.update(id, data);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.promotionService.remove(id);
    }
  }
  