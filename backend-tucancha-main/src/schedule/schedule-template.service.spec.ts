import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScheduleTemplateService } from './schedule-template.service';
import { ScheduleTemplate } from './schedule_template.entity';
import { CourtScheduleAvailability } from './court_schedule_availability.entity';
import { CourtService } from '../court/court.service';
import { ForbiddenException } from '@nestjs/common';

describe('ScheduleTemplateService', () => {
  let service: ScheduleTemplateService;
  let templateRepo: any;
  let availabilityRepo: any;
  let courtService: any;

  const mockTemplateRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockAvailabilityRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const mockCourtService = {
    findOne: jest.fn(),
    findAllByVenueByClub: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleTemplateService,
        {
          provide: getRepositoryToken(ScheduleTemplate),
          useValue: mockTemplateRepo,
        },
        {
          provide: getRepositoryToken(CourtScheduleAvailability),
          useValue: mockAvailabilityRepo,
        },
        {
          provide: CourtService,
          useValue: mockCourtService,
        },
      ],
    }).compile();

    service = module.get<ScheduleTemplateService>(ScheduleTemplateService);
    templateRepo = module.get(getRepositoryToken(ScheduleTemplate));
    availabilityRepo = module.get(getRepositoryToken(CourtScheduleAvailability));
    courtService = module.get(CourtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByClub', () => {
    it('should return an array of templates for the given clubId', async () => {
      const clubId = 'club-123';
      const mockTemplates = [
        { id: 'tpl-1', name: 'Plantilla 1', club: { id: clubId } },
        { id: 'tpl-2', name: 'Plantilla 2', club: { id: clubId } },
      ];
      mockTemplateRepo.find.mockResolvedValue(mockTemplates);

      const result = await service.findAllByClub(clubId);

      expect(templateRepo.find).toHaveBeenCalledWith({
        where: { club: { id: clubId } },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('bulkUpdate', () => {
    it('should throw ForbiddenException if court does not belong to user club', async () => {
      const clubId = 'club-admin';
      const slots = [
        { courtId: 'court-other', date: '2026-08-15', time: '10:00', status: 'available' as any },
      ];

      mockCourtService.findOne.mockResolvedValue({
        id: 'court-other',
        venue: { club: { id: 'club-enemy' } },
      });

      await expect(service.bulkUpdate(slots, clubId)).rejects.toThrow(ForbiddenException);
    });

    it('should execute transaction when authorization succeeds', async () => {
      const clubId = 'club-admin';
      const slots = [
        { courtId: 'court-1', date: '2026-08-15', time: '10:00', status: 'blocked' as any },
      ];

      mockCourtService.findOne.mockResolvedValue({
        id: 'court-1',
        venue: { club: { id: clubId } },
      });

      mockAvailabilityRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const mockManager = {
          update: jest.fn().mockResolvedValue(true),
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue({ id: 'new-slot' }),
          save: jest.fn().mockResolvedValue({ id: 'new-slot' }),
        };
        return cb(mockManager);
      });

      const result = await service.bulkUpdate(slots, clubId);

      expect(result).toEqual([{ success: true, index: 0 }]);
    });
  });
});
