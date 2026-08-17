// src/venue/venue.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from './entities/venue.entity';
// import { ClubService } from '../club/club.service';
import { Club } from '../club/club.entity';

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue)
    private venueRepo: Repository<Venue>,
    // private clubService: ClubService
  ) {}

  findAll() {
    // return this.venueRepo.find({ relations: ['club', 'courts'] });
    return this.venueRepo.find();
  }

  findOne(id: number) {
    return this.venueRepo.findOne({
      where: { id }
    });
  }
  
  totalByClub(clubId){
    return this.venueRepo.createQueryBuilder('venue')
    .where('venue.clubId = :clubId', { clubId })
    .getCount();
  }

  async findAllByClub(club:Partial<Club>){
      return this.venueRepo.find({
      where: {
        club: { id: club.id },
      },
    });
  }
  async create(data, user) {
    const club = user.club;
    if (!club) throw new NotFoundException('Club no encontrado')
    const venue = this.venueRepo.create({...data, club})
    return this.venueRepo.save(venue);
  }

  async update(id: number, data: Partial<Venue>) {
    await this.venueRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const venue = await this.findOne(id);
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }
    return this.venueRepo.remove(venue);
  }

}
