import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadImageDto } from './dto/upload-image.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload and process image with AI aura generation',
    description: 'Uploads an image, analyzes with Gemini AI for aura generation, and stores if successful',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Image uploaded and AI aura generated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        originalUrl: { type: 'string' },
        publicId: { type: 'string' },
        fileName: { type: 'string' },
        fileSize: { type: 'number' },
        mimeType: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        aura: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            mood: { type: 'string' },
            colors: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            likes: { type: 'number' },
            shares: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type, file too large, or AI analysis failed',
  })
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.imagesService.uploadImage(file, req.user.id);
  }

  @Post('test-upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Test upload endpoint (bypasses auth for testing)',
    description: 'Test endpoint for uploading and processing images without authentication',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Image uploaded and AI aura generated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        originalUrl: { type: 'string' },
        publicId: { type: 'string' },
        fileName: { type: 'string' },
        fileSize: { type: 'number' },
        mimeType: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        aura: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            mood: { type: 'string' },
            colors: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            likes: { type: 'number' },
            shares: { type: 'number' },
          },
        },
      },
    },
  })
  async testUploadImage(@UploadedFile() file: Express.Multer.File) {
    // Create a test user ID for testing
    const testUserId = 'test-user-123';
    
    try {
      // Ensure test user exists in database
      let testUser = await this.prismaService.user.findUnique({
        where: { id: testUserId }
      });

      if (!testUser) {
        testUser = await this.prismaService.user.create({
          data: {
            id: testUserId,
            firstName: 'Test',
            lastName: 'User',
            phoneNumber: '+1234567890',
            birthday: new Date('1990-01-01'),
            isVerified: true,
          }
        });
      }

      // Use the regular upload service
      return this.imagesService.uploadImage(file, testUserId);
    } catch (error) {
      throw new BadRequestException(`Test upload failed: ${error.message}`);
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get image details',
    description: 'Retrieves detailed information about a specific image including processing results',
  })
  @ApiResponse({
    status: 200,
    description: 'Image details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        originalUrl: { type: 'string' },
        processedUrl: { type: 'string' },
        publicId: { type: 'string' },
        fileName: { type: 'string' },
        fileSize: { type: 'number' },
        mimeType: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        isProcessed: { type: 'boolean' },
        processingStatus: { type: 'string' },
        croppedUrl: { type: 'string' },
        backgroundRemovedUrl: { type: 'string' },
        faceDetectedUrl: { type: 'string' },
        aura: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            mood: { type: 'string' },
            colors: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            likes: { type: 'number' },
            shares: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Image not found',
  })
  async getImage(@Param('id') imageId: string, @Request() req) {
    return this.imagesService.getImage(imageId, req.user.id);
  }

  @Get('user/my-images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user images',
    description: 'Retrieves paginated list of images uploaded by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User images retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              originalUrl: { type: 'string' },
              processedUrl: { type: 'string' },
              fileName: { type: 'string' },
              processingStatus: { type: 'string' },
              createdAt: { type: 'string' },
              aura: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  mood: { type: 'string' },
                  likes: { type: 'number' },
                  shares: { type: 'number' },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async getUserImages(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.imagesService.getUserImages(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get(':id/analysis')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get detailed image analysis',
    description: 'Retrieves AI-powered analysis results from Cloudinary including color extraction and object detection',
  })
  @ApiResponse({
    status: 200,
    description: 'Image analysis retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        format: { type: 'string' },
        colorAnalysis: { type: 'object' },
        objectDetection: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Image not found',
  })
  async getImageAnalysis(@Param('id') imageId: string, @Request() req) {
    return this.imagesService.getImageAnalysis(imageId, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete image',
    description: 'Deletes an image and all its associated data including aura information',
  })
  @ApiResponse({
    status: 200,
    description: 'Image deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Image not found',
  })
  async deleteImage(@Param('id') imageId: string, @Request() req) {
    return this.imagesService.deleteImage(imageId, req.user.id);
  }
} 