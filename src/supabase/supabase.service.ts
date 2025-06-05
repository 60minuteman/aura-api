import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get('supabase.url');
    const supabaseKey = this.configService.get('supabase.serviceKey');
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase not configured. Image storage will be disabled.');
      return;
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(
    buffer: Buffer,
    filename: string,
    userId: string,
  ): Promise<{
    originalUrl: string;
    publicId: string;
    fileName: string;
  }> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage is not configured');
    }

    try {
      // Create a unique filename
      const timestamp = Date.now();
      const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFileName = `${userId}/${timestamp}_${cleanFilename}`;

      console.log(`📤 Uploading to Supabase Storage: ${uniqueFileName}`);

      // Upload to Supabase Storage bucket
      const { data, error } = await this.supabase.storage
        .from('aura-images')
        .upload(uniqueFileName, buffer, {
          contentType: this.detectMimeType(filename),
        });

      if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from('aura-images')
        .getPublicUrl(uniqueFileName);

      console.log(`✅ Successfully uploaded to Supabase: ${publicUrlData.publicUrl}`);

      return {
        originalUrl: publicUrlData.publicUrl,
        publicId: uniqueFileName,
        fileName: filename,
      };
    } catch (error) {
      console.error('Supabase upload error:', error);
      throw new BadRequestException(`Failed to upload image to Supabase: ${error.message}`);
    }
  }

  /**
   * Delete image from Supabase Storage
   */
  async deleteImage(publicId: string): Promise<void> {
    if (!this.supabase) {
      throw new BadRequestException('Supabase storage is not configured');
    }

    try {
      const { error } = await this.supabase.storage
        .from('aura-images')
        .remove([publicId]);

      if (error) {
        throw new Error(`Supabase delete error: ${error.message}`);
      }

      console.log(`🗑️ Successfully deleted from Supabase: ${publicId}`);
    } catch (error) {
      console.error('Supabase delete error:', error);
      throw new BadRequestException(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Detect MIME type from filename
   */
  private detectMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }
} 