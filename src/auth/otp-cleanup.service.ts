import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OtpCleanupService {
  private readonly logger = new Logger(OtpCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupOtps() {
    this.logger.log('🧹 Starting OTP cleanup...');

    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      // Delete verified OTPs (isUsed = true)
      const verifiedOtpsDeleted = await this.prisma.oTP.deleteMany({
        where: {
          isUsed: true,
        },
      });

      // Delete unused OTPs that are older than 30 minutes
      const expiredUnusedOtpsDeleted = await this.prisma.oTP.deleteMany({
        where: {
          isUsed: false,
          createdAt: {
            lt: thirtyMinutesAgo,
          },
        },
      });

      this.logger.log(`✅ OTP cleanup completed:
        - Verified OTPs deleted: ${verifiedOtpsDeleted.count}
        - Expired unused OTPs deleted: ${expiredUnusedOtpsDeleted.count}
        - Total cleaned: ${verifiedOtpsDeleted.count + expiredUnusedOtpsDeleted.count}`);

    } catch (error) {
      this.logger.error('❌ OTP cleanup failed:', error);
    }
  }

  // Manual cleanup method (can be called directly if needed)
  async performCleanup(): Promise<{
    verifiedOtpsDeleted: number;
    expiredUnusedOtpsDeleted: number;
    totalDeleted: number;
  }> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const verifiedOtpsDeleted = await this.prisma.oTP.deleteMany({
      where: {
        isUsed: true,
      },
    });

    const expiredUnusedOtpsDeleted = await this.prisma.oTP.deleteMany({
      where: {
        isUsed: false,
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
    });

    const totalDeleted = verifiedOtpsDeleted.count + expiredUnusedOtpsDeleted.count;

    this.logger.log(`Manual cleanup completed - Total deleted: ${totalDeleted}`);

    return {
      verifiedOtpsDeleted: verifiedOtpsDeleted.count,
      expiredUnusedOtpsDeleted: expiredUnusedOtpsDeleted.count,
      totalDeleted,
    };
  }
} 