import { Controller, Post, Body, UseGuards, Get, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { OtpCleanupService } from './otp-cleanup.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpCleanupService: OtpCleanupService,
  ) {}

  @Post('send-otp')
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description: 'Sends a 6-digit OTP code to the provided phone number via SMS',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP sent successfully' },
        code: { type: 'string', example: '123456', description: 'Only in development mode' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number or failed to send OTP',
  })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('verify-otp')
  @ApiOperation({
    summary: 'Verify OTP and login/check registration status',
    description: 'Verifies the OTP code and returns JWT token for existing users or registration prompt for new users',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                phoneNumber: { type: 'string' },
                birthday: { type: 'string' },
                isVerified: { type: 'boolean' },
              },
            },
            isNewUser: { type: 'boolean', example: false },
          },
        },
        {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'OTP verified. Please complete registration.' },
            phoneNumber: { type: 'string' },
            isNewUser: { type: 'boolean', example: true },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired OTP',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register')
  @UseInterceptors(FileInterceptor('profilePicture'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Complete user registration',
    description: 'Registers a new user with personal details and optional profile picture after OTP verification',
  })
  @ApiBody({
    description: 'Registration data with optional profile picture',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        phoneNumber: { type: 'string', example: '+1234567890' },
        birthday: { type: 'string', example: '1990-01-01' },
        profilePicture: {
          type: 'string',
          format: 'binary',
          description: 'Optional profile picture (JPEG, PNG, WebP, max 10MB)',
        },
      },
      required: ['firstName', 'lastName', 'phoneNumber', 'birthday'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phoneNumber: { type: 'string' },
            birthday: { type: 'string' },
            isVerified: { type: 'boolean' },
            profilePictureUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
  })
  async register(
    @Body() registerUserDto: RegisterUserDto,
    @UploadedFile() profilePicture?: Express.Multer.File,
  ) {
    return this.authService.register(registerUserDto, profilePicture);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh JWT token',
    description: 'Generates a new JWT token for authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async refreshToken(@Request() req) {
    return this.authService.refreshToken(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile information of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phoneNumber: { type: 'string' },
        profilePictureUrl: { type: 'string', nullable: true },
      },
    },
  })
  async getProfile(@Request() req) {
    return req.user;
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user statistics',
    description: 'Returns user stats including daily scans, total scans, followers, and following counts',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        dailyScans: { 
          type: 'number', 
          description: 'Number of images scanned today' 
        },
        totalScans: { 
          type: 'number', 
          description: 'Total number of images scanned by user' 
        },
        followers: { 
          type: 'number', 
          description: 'Number of users following this user' 
        },
        following: { 
          type: 'number', 
          description: 'Number of users this user is following' 
        },
        scanStreak: {
          type: 'number',
          description: 'Number of consecutive days with at least one scan'
        },
      },
    },
  })
  async getUserStats(@Request() req) {
    return this.authService.getUserStats(req.user.id);
  }

  @Post('cleanup-otps')
  @ApiOperation({
    summary: 'Manual OTP cleanup',
    description: 'Manually trigger OTP cleanup - removes verified OTPs and unused OTPs older than 30 minutes',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP cleanup completed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        verifiedOtpsDeleted: { type: 'number' },
        expiredUnusedOtpsDeleted: { type: 'number' },
        totalDeleted: { type: 'number' },
      },
    },
  })
  async cleanupOtps() {
    const result = await this.otpCleanupService.performCleanup();
    return {
      message: 'OTP cleanup completed successfully',
      ...result,
    };
  }
} 