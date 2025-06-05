import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { GeminiService } from '../gemini/gemini.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImagesService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private geminiService: GeminiService,
    private configService: ConfigService,
  ) {}

  async uploadImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{
    id: string;
    originalUrl: string;
    publicId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    width: number;
    height: number;
    aura: {
      id: string;
      title: string;
      description: string;
      mood: string;
      colors: string[];
      keywords: string[];
      confidence: number;
      likes: number;
      shares: number;
    };
  }> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const allowedMimeTypes = this.configService.get('upload.allowedMimeTypes');
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, WebP are allowed');
    }

    const maxFileSize = this.configService.get('upload.maxFileSize');
    if (file.size > maxFileSize) {
      throw new BadRequestException(`File size exceeds ${maxFileSize} bytes`);
    }

    try {
      console.log('🤖 Step 1: Analyzing image with Gemini AI first...');
      
      // STEP 1: Analyze with Gemini FIRST (before storing anything)
      const aiAura = await this.geminiService.generateAuraFromBuffer(
        file.buffer,
        file.mimetype
      );

      console.log(`✨ Gemini analysis successful: "${aiAura.title}"`);

      console.log('📤 Step 2: Uploading image to Cloudinary...');
      
      // STEP 2: Only if Gemini succeeds, upload to Cloudinary
      const uploadResult = await this.cloudinaryService.uploadImage(
        file.buffer,
        file.originalname,
        userId,
      );

      console.log('💾 Step 3: Saving to database...');

      // STEP 3: Save image to database
      const image = await this.prisma.image.create({
        data: {
          originalUrl: uploadResult.originalUrl,
          publicId: uploadResult.publicId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          width: uploadResult.width,
          height: uploadResult.height,
          isProcessed: true,
          processingStatus: 'completed',
          userId,
        },
      });

      // STEP 4: Save aura data
      const aura = await this.prisma.aura.create({
        data: {
          title: aiAura.title,
          description: aiAura.description,
          mood: aiAura.mood,
          keywords: aiAura.keywords,
          confidence: aiAura.confidence,
          colors: [], // No color extraction for now
          imageId: image.id,
          userId,
        },
      });

      console.log(`🎉 Complete flow successful!`);

      // Return simplified response
      return {
        id: image.id,
        originalUrl: image.originalUrl,
        publicId: image.publicId,
        fileName: image.fileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        width: image.width || 0,
        height: image.height || 0,
        aura: {
          id: aura.id,
          title: aura.title,
          description: aura.description,
          mood: aura.mood!,
          colors: aura.colors,
          keywords: aura.keywords,
          confidence: aura.confidence!,
          likes: aura.likes,
          shares: aura.shares,
        },
      };
    } catch (error) {
      console.error('❌ Image processing failed:', error);
      
      // If Gemini fails, the whole operation fails
      if (error.message?.includes('Gemini') || error.message?.includes('AI')) {
        throw new BadRequestException(`AI aura analysis failed: ${error.message}`);
      }
      
      throw new BadRequestException(`Failed to process image: ${error.message}`);
    }
  }

  async getImage(imageId: string, userId: string) {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        userId,
      },
      include: {
        aura: true,
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return image;
  }

  async getUserImages(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [images, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId },
        include: {
          aura: {
            select: {
              id: true,
              title: true,
              description: true,
              mood: true,
              likes: true,
              shares: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.image.count({
        where: { userId },
      }),
    ]);

    return {
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteImage(imageId: string, userId: string): Promise<void> {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        userId,
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteImage(image.publicId);

    // Delete from database (will cascade delete aura)
    await this.prisma.image.delete({
      where: { id: imageId },
    });
  }

  async getImageAnalysis(imageId: string, userId: string) {
    const image = await this.prisma.image.findFirst({
      where: {
        id: imageId,
        userId,
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (!image.isProcessed) {
      throw new BadRequestException('Image is still being processed');
    }

    // Get detailed analysis from Cloudinary
    const analysis = await this.cloudinaryService.getImageAnalysis(image.publicId);

    return {
      ...image,
      analysis,
    };
  }
} 