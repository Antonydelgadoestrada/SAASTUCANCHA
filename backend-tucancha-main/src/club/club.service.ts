import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Club } from './club.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { S3Service } from '../aws/s3.service';

@Injectable()
export class ClubService {
  constructor(
    @InjectRepository(Club)
    private readonly repo: Repository<Club>,
    private readonly s3Service: S3Service
  ) {}

  findAll() {
    return this.repo.find({ relations: ['owner'] });
  }

  findAllTop() {
    return this.repo.find({
      relations: ['owner'],
      order: { createdAt: 'ASC' }, // primeros creados
      take: 10,
    });
  }

  findAllWithToken() {
    return this.repo.find({
      where: {
        mpTokenExpiresAt: Not(IsNull()),
      },
      relations: ['owner'],
    });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['owner'] });
  }

  create(data: Partial<Club>) {
    const club = this.repo.create(data);
    return this.repo.save(club);
  }

  async update(id: string, data: Partial<Club>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
  findByConditicion(where: Object) {
    return this.repo.findOne({ where: where });
  }

  uploadFiles(images:any[]){
    if(images.length == 0) return []
    return this.s3Service.uploadFiles(images, '/curt')
  }

  async approveClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'APPROVED';
    club.approvedAt = new Date();
  
    return this.repo.save(club);
  }

  async rejectClub(id: string) {
    const club = await this.repo.findOne({ where: { id } });
    if (!club) throw new NotFoundException('Club no encontrado');
  
    club.status = 'REJECTED';
    club.approvedAt = new Date();
  
    return this.repo.save(club);
  }

  async updateClubWithMP(user_id, access_token, refresh_token, clubId, tokenExpiresAt){
    return this.repo.update(clubId, {mpUserId: user_id, mpAccessToken: access_token, mpRefreshToken:refresh_token, mpTokenExpiresAt:tokenExpiresAt})
  }
  
}
