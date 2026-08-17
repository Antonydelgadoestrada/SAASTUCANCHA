import { Test, TestingModule } from '@nestjs/testing';
import { CourtController } from './court.controller';

describe('CourtController', () => {
  let controller: CourtController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourtController],
    }).compile();

    controller = module.get<CourtController>(CourtController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
