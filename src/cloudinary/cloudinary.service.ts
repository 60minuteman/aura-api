import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('cloudinary.cloudName'),
      api_key: this.configService.get('cloudinary.apiKey'),
      api_secret: this.configService.get('cloudinary.apiSecret'),
    });
  }

  /**
   * Upload image to Cloudinary with basic transformations
   */
  async uploadImage(
    buffer: Buffer,
    filename: string,
    userId: string,
  ): Promise<{
    originalUrl: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  }> {
    try {
      const folder = this.configService.get('cloudinary.folder');
      // Simplified public ID without nested folder structure to avoid conflicts
      const timestamp = Date.now();
      const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const publicId = `${folder}/users/${userId}/${timestamp}_${cleanFilename}`;

      console.log(`📤 Uploading to Cloudinary with publicId: ${publicId}`);

      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${buffer.toString('base64')}`,
        {
          public_id: publicId,
          resource_type: 'image',
          quality: 'auto:best',
          fetch_format: 'auto',
          overwrite: false, // Don't overwrite existing images
        },
      );

      console.log(`✅ Successfully uploaded to Cloudinary:
        - Public ID: ${result.public_id}
        - URL: ${result.secure_url}
        - Size: ${result.width}x${result.height}
        - Format: ${result.format}
        - Bytes: ${result.bytes}`);

      return {
        originalUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  /**
   * Upload profile picture to Cloudinary with profile-specific transformations
   */
  async uploadProfilePicture(
    file: Express.Multer.File,
  ): Promise<{
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  }> {
    try {
      const folder = this.configService.get('cloudinary.folder');
      const timestamp = Date.now();
      const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const publicId = `${folder}/profile_pictures/${timestamp}_${cleanFilename}`;

      console.log(`📤 Uploading profile picture to Cloudinary with publicId: ${publicId}`);

      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          public_id: publicId,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // Square crop focusing on face
            { quality: 'auto:good' },
            { format: 'auto' },
          ],
          overwrite: false,
        },
      );

      console.log(`✅ Successfully uploaded profile picture to Cloudinary:
        - Public ID: ${result.public_id}
        - URL: ${result.secure_url}
        - Size: ${result.width}x${result.height}
        - Format: ${result.format}
        - Bytes: ${result.bytes}`);

      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };
    } catch (error) {
      console.error('Profile picture upload error:', error);
      throw new BadRequestException('Failed to upload profile picture');
    }
  }

  /**
   * Process image with AI-powered transformations for aura generation
   */
  async processImageForAura(publicId: string): Promise<{
    processedUrl: string;
    croppedUrl: string;
    backgroundRemovedUrl: string;
    faceDetectedUrl?: string;
  }> {
    try {
      console.log(`🎨 Processing transformations for publicId: ${publicId}`);

      // Background removed version for isolated subject (using proper transformation array)
      const backgroundRemovedUrl = cloudinary.url(publicId, {
        transformation: [
          { effect: 'background_removal' },
          { format: 'png' }, // Background removal should output PNG for transparency
          { quality: 'auto:best' }
        ]
      });

      // Auto-cropped version with smart object detection
      const croppedUrl = cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      // Main processed version with enhanced quality
      const processedUrl = cloudinary.url(publicId, {
        transformation: [
          { width: 1024, height: 1024, crop: 'limit' },
          { effect: 'auto_color' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      // Face-detected version (if applicable)
      let faceDetectedUrl: string | undefined;
      try {
        faceDetectedUrl = cloudinary.url(publicId, {
          transformation: [
            { width: 600, height: 600, crop: 'crop', gravity: 'face' },
            { quality: 'auto:best' },
            { format: 'auto' }
          ]
        });
      } catch (error) {
        console.log('Face detection not applicable for this image');
      }

      console.log(`✅ Generated transformation URLs:
        - Background removed: ${backgroundRemovedUrl.substring(0, 100)}...
        - Cropped: ${croppedUrl.substring(0, 100)}...
        - Processed: ${processedUrl.substring(0, 100)}...`);

      return {
        processedUrl,
        croppedUrl,
        backgroundRemovedUrl,
        faceDetectedUrl,
      };
    } catch (error) {
      console.error('Cloudinary processing error:', error);
      throw new BadRequestException('Failed to process image');
    }
  }

  /**
   * Extract dominant colors from image for aura analysis
   */
  async extractColors(publicId: string): Promise<string[]> {
    try {
      // Use Cloudinary's auto color extraction
      const analysisUrl = cloudinary.url(publicId, {
        flags: 'getinfo',
      });

      // For now, we'll return placeholder colors
      // In a full implementation, you'd make an API call to get color analysis
      return ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    } catch (error) {
      console.error('Color extraction error:', error);
      return [];
    }
  }

  /**
   * Generate different aura-themed variations of the image
   */
  async generateAuraVariations(publicId: string): Promise<{
    mysteriousAura: string;
    vibrantAura: string;
    calmingAura: string;
    energeticAura: string;
  }> {
    try {
      const mysteriousAura = cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
          { effect: 'sepia:50' },
          { color: 'purple' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      const vibrantAura = cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
          { effect: 'saturation:30' },
          { effect: 'brightness:10' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      const calmingAura = cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
          { effect: 'blue:30' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      const energeticAura = cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'auto', gravity: 'auto' },
          { effect: 'saturation:50' },
          { effect: 'contrast:20' },
          { color: 'orange' },
          { quality: 'auto:best' },
          { format: 'auto' }
        ]
      });

      return {
        mysteriousAura,
        vibrantAura,
        calmingAura,
        energeticAura,
      };
    } catch (error) {
      console.error('Aura variations error:', error);
      throw new BadRequestException('Failed to generate aura variations');
    }
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      // Don't throw error for delete operations to avoid blocking other operations
    }
  }

  /**
   * Get image analysis data from Cloudinary
   */
  async getImageAnalysis(publicId: string): Promise<{
    width: number;
    height: number;
    format: string;
    colorAnalysis?: any;
    objectDetection?: any;
  }> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        image_metadata: true,
        colors: true,
        coordinates: true,
      });

      return {
        width: result.width,
        height: result.height,
        format: result.format,
        colorAnalysis: result.colors,
        objectDetection: result.coordinates,
      };
    } catch (error) {
      console.error('Image analysis error:', error);
      throw new BadRequestException('Failed to analyze image');
    }
  }
} 