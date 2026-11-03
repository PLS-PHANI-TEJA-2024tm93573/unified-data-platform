import { Module } from '@nestjs/common';
import { MetadataChangeDetectorService } from './metadata-change-detector.service';

@Module({
  providers: [MetadataChangeDetectorService],
  exports: [MetadataChangeDetectorService],
})
export class MetadataModule {}
