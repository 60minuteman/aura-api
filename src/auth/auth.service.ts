import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import * as twilio from 'twilio';

@Injectable()
export class AuthService {
  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cloudinaryService: CloudinaryService,
  ) {
    const accountSid = this.configService.get('twilio.accountSid');
    const authToken = this.configService.get('twilio.authToken');
    
    // Only initialize Twilio if we have valid-looking credentials
    if (accountSid && authToken && accountSid.startsWith('AC') && authToken.length > 10) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
      } catch (error) {
        console.warn('Failed to initialize Twilio client:', error.message);
        this.twilioClient = null;
      }
    } else {
      console.warn('Twilio credentials not configured or invalid. SMS functionality will be disabled.');
    }
  }

  async sendOtp(sendOtpDto: SendOtpDto) {
    const { phoneNumber } = sendOtpDto;

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await this.prisma.oTP.create({
      data: {
        phoneNumber,
        code,
        expiresAt,
      },
    });

    // Send OTP via Twilio (if configured)
    if (this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: `Your Aura verification code is: ${code}`,
          from: this.configService.get('twilio.phoneNumber'),
          to: phoneNumber,
        });
        
        console.log(`✅ SMS sent successfully to ${phoneNumber}`);
      } catch (error) {
        console.error('Failed to send SMS:', error);
        
        // Handle specific Twilio errors
        if (error.code === 21408) {
          console.error(`❌ Geographic restriction: Cannot send SMS to ${phoneNumber.substring(0, 4)}... region. Please verify this number in Twilio Console first.`);
          
          // For Nigerian numbers, provide specific guidance
          if (phoneNumber.startsWith('+234')) {
            console.error('🇳🇬 Nigerian numbers require verification in Twilio Console or sender ID registration.');
            console.error('Visit: https://console.twilio.com/us1/develop/phone-numbers/verified-caller-ids');
          }
        } else if (error.code === 'ENOTFOUND') {
          console.error('❌ Network connectivity issue to Twilio API. Please check internet connection.');
        }
        
        // In development, we might want to continue without SMS
        if (this.configService.get('nodeEnv') === 'production') {
          throw new BadRequestException(`Failed to send OTP: ${error.message || error.code || 'Unknown error'}`);
        }
      }
    } else {
      console.log(`📱 SMS not configured. OTP code for ${phoneNumber}: ${code}`);
    }

    return {
      message: 'OTP sent successfully',
      // In development, return the code for testing
      ...(this.configService.get('nodeEnv') === 'development' && { code }),
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { phoneNumber, code } = verifyOtpDto;

    // Find valid OTP
    const otp = await this.prisma.oTP.findFirst({
      where: {
        phoneNumber,
        code,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Mark OTP as used
    await this.prisma.oTP.update({
      where: { id: otp.id },
      data: { isUsed: true },
    });

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      // User exists, generate JWT and return
      const payload = { sub: existingUser.id, phoneNumber: existingUser.phoneNumber };
      const accessToken = this.jwtService.sign(payload);

      // Generate DiceBear avatar if user doesn't have a profile picture
      let profilePictureUrl = existingUser.profilePictureUrl;
      if (!profilePictureUrl) {
        const seed = phoneNumber.replace(/[^a-zA-Z0-9]/g, '');
        profilePictureUrl = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}&size=400&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
        
        // Update user with DiceBear avatar
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { profilePictureUrl },
        });
        
        console.log(`🎭 Generated DiceBear avatar for existing user ${phoneNumber}: ${profilePictureUrl}`);
      }

      return {
        accessToken,
        user: {
          id: existingUser.id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          phoneNumber: existingUser.phoneNumber,
          birthday: existingUser.birthday,
          isVerified: existingUser.isVerified,
          profilePictureUrl,
        },
        isNewUser: false,
      };
    }

    // User doesn't exist, return indication for registration
    return {
      message: 'OTP verified. Please complete registration.',
      phoneNumber,
      isNewUser: true,
    };
  }

  async register(registerUserDto: RegisterUserDto, profilePicture?: Express.Multer.File) {
    const { phoneNumber, firstName, lastName, birthday } = registerUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    let profilePictureUrl: string | null = null;
    let profilePublicId: string | null = null;

    // Upload profile picture if provided
    if (profilePicture) {
      try {
        const uploadResult = await this.cloudinaryService.uploadProfilePicture(profilePicture);
        profilePictureUrl = uploadResult.secure_url;
        profilePublicId = uploadResult.public_id;
      } catch (error) {
        console.error('Profile picture upload failed:', error);
        // Continue registration without profile picture
        // Will use DiceBear avatar as fallback
      }
    }

    // If no profile picture was uploaded or upload failed, generate DiceBear avatar
    if (!profilePictureUrl) {
      // Use phone number as seed for consistent avatar generation
      const seed = phoneNumber.replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters
      profilePictureUrl = `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${seed}&size=400&radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      
      console.log(`🎭 Generated DiceBear avatar for ${phoneNumber}: ${profilePictureUrl}`);
    }

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        phoneNumber,
        birthday: new Date(birthday),
        isVerified: true,
        profilePictureUrl,
        profilePublicId, // Will be null for DiceBear avatars
      },
    });

    // Generate JWT
    const payload = { sub: user.id, phoneNumber: user.phoneNumber };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        birthday: user.birthday,
        isVerified: user.isVerified,
        profilePictureUrl: user.profilePictureUrl,
      },
    };
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user.id, phoneNumber: user.phoneNumber };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async getUserStats(userId: string): Promise<{
    dailyScans: number;
    totalScans: number;
    followers: number;
    following: number;
    scanStreak: number;
  }> {
    // Get today's date range (start and end of today)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get daily scans (images uploaded today)
    const dailyScans = await this.prisma.image.count({
      where: {
        userId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    // Get total scans (all images uploaded by user)
    const totalScans = await this.prisma.image.count({
      where: {
        userId,
      },
    });

    // Get followers count (users following this user)
    const followers = await this.prisma.follow.count({
      where: {
        followingId: userId, // This user is being followed
      },
    });

    // Get following count (users this user is following)
    const following = await this.prisma.follow.count({
      where: {
        followerId: userId, // This user is following others
      },
    });

    // Calculate scan streak (consecutive days with at least one scan)
    const scanStreak = await this.calculateScanStreak(userId);

    return {
      dailyScans,
      totalScans,
      followers,
      following,
      scanStreak,
    };
  }

  private async calculateScanStreak(userId: string): Promise<number> {
    try {
      // Get all scan dates for the user, grouped by date
      const scanDates = await this.prisma.image.findMany({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      if (scanDates.length === 0) {
        return 0;
      }

      // Convert to unique dates (YYYY-MM-DD format)
      const uniqueDates = Array.from(
        new Set(
          scanDates.map(scan => 
            scan.createdAt.toISOString().split('T')[0]
          )
        )
      ).sort().reverse(); // Most recent first

      if (uniqueDates.length === 0) {
        return 0;
      }

      // Check if there's a scan today or yesterday to start the streak
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
        return 0; // No recent activity
      }

      let streak = 0;
      let expectedDate = new Date();

      for (const dateString of uniqueDates) {
        const scanDate = new Date(dateString);
        const expectedDateString = expectedDate.toISOString().split('T')[0];

        if (scanDate.toISOString().split('T')[0] === expectedDateString) {
          streak++;
          // Move to previous day
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break; // Streak broken
        }
      }

      return streak;
    } catch (error) {
      console.error('Error calculating scan streak:', error);
      return 0;
    }
  }
} 