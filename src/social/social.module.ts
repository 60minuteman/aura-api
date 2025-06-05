import { Module } from '@nestjs/common';
import { SocialController, ExploreController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  controllers: [SocialController, ExploreController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {} 