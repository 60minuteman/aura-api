import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('gemini.apiKey');
    if (!apiKey) {
      console.warn('Gemini API key not configured. AI aura generation will be disabled.');
      return;
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Analyzes an image buffer directly and generates aura description
   * NO FALLBACKS - if this fails, the whole operation should fail
   */
  async generateAuraFromBuffer(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<{
    title: string;
    description: string;
    mood: string;
    keywords: string[];
    confidence: number;
  }> {
    if (!this.genAI) {
      throw new BadRequestException('Gemini AI is not configured. Please check GEMINI_API_KEY environment variable.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `
        Analyze this image and generate a fun, humorous aura description based on what you see.

        Please provide a response in the following JSON format:
        {
          "title": "A funny, catchy 3-5 word title for this aura",
          "description": "A short, humorous description of the aura in exactly 3 lines. Make it fun, witty, and entertaining. Each line should be punchy and amusing.",
          "mood": "One word describing the primary vibe (e.g., Silly, Cheeky, Playful, Quirky, Sassy, Chill, Dramatic, Confident)",
          "keywords": ["3-5 funny or playful keywords that describe this aura"],
          "confidence": 0.85
        }

        Make it:
        - SHORT: Exactly 3 lines for description
        - FUNNY: Use humor, puns, playful language
        - RELATABLE: Modern, casual tone
        - WITTY: Clever observations about what you see

        Avoid being too mystical or serious. Keep it light and entertaining!
      `;

      console.log(`🔍 Sending ${imageBuffer.length} bytes to Gemini for analysis...`);
      console.log(`🔍 MIME type: ${mimeType}`);

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();

      console.log('🤖 Raw Gemini response received');

      // Parse JSON response
      try {
        // Clean up the response text - remove markdown code blocks
        let cleanText = text.trim();
        
        // Remove markdown code block markers
        cleanText = cleanText.replace(/```json\s*\n?/gi, '');
        cleanText = cleanText.replace(/```\s*$/gi, '');
        cleanText = cleanText.replace(/^```\s*/gi, '');
        
        // Try to extract JSON from the response
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        }
        
        console.log('🔍 Attempting to parse cleaned text:', cleanText.substring(0, 200));
        
        const parsed = JSON.parse(cleanText);
        
        // Validate response structure
        if (!parsed.title || !parsed.description || !parsed.mood) {
          throw new Error('Invalid response structure from Gemini');
        }

        console.log(`✅ Gemini analysis successful: "${parsed.title}"`);

        return {
          title: parsed.title,
          description: parsed.description,
          mood: parsed.mood,
          keywords: parsed.keywords || [],
          confidence: parsed.confidence || 0.75,
        };
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response:', parseError);
        console.log('Raw Gemini response:', text.substring(0, 500));
        
        throw new BadRequestException(`Gemini returned invalid response format: ${parseError.message}`);
      }

    } catch (error) {
      console.error('❌ Gemini API error:', error);
        
      // Re-throw the error - no fallbacks
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Gemini AI analysis failed: ${error.message}`);
    }
  }

  /**
   * DEPRECATED: Old method that uses URL - keeping for backward compatibility but not recommended
   */
  async generateAuraDescription(backgroundRemovedImageUrl: string): Promise<{
    title: string;
    description: string;
    mood: string;
    keywords: string[];
    confidence: number;
  }> {
    console.warn('⚠️ Using deprecated generateAuraDescription method. Use generateAuraFromBuffer instead.');
    
    if (!this.genAI) {
      throw new BadRequestException('Gemini AI is not configured. Please check GEMINI_API_KEY environment variable.');
    }

    try {
      // Convert image URL to buffer and use the new method
      const imageData = await this.fetchImageAsBase64(backgroundRemovedImageUrl);
      const mimeType = this.detectMimeType(backgroundRemovedImageUrl, imageData);
      const buffer = Buffer.from(imageData, 'base64');
      
      return this.generateAuraFromBuffer(buffer, mimeType);

    } catch (error) {
      console.error('Gemini API error:', error);
      throw new BadRequestException(`Gemini AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Fetch image from URL and convert to base64 with retry logic
   */
  private async fetchImageAsBase64(imageUrl: string): Promise<string> {
    const maxRetries = 3;
    const delayMs = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Fetching image (attempt ${attempt}/${maxRetries}): ${imageUrl.substring(0, 100)}...`);
        
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(imageUrl, {
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'Aura-API/1.0',
          },
        });
        
        if (!response.ok) {
          if (attempt < maxRetries) {
            console.log(`⏱️ Image not ready yet (${response.status} ${response.statusText}), waiting ${delayMs/1000}s before retry...`);
            await this.sleep(delayMs);
            continue;
          }
          throw new Error(`Failed to fetch image: ${response.statusText} (${response.status})`);
        }

        const buffer = await response.buffer();
        console.log(`✅ Successfully fetched image (${buffer.length} bytes)`);
        
        // Validate that we got an actual image
        if (buffer.length < 100) {
          throw new Error('Received invalid or empty image data');
        }
        
        return buffer.toString('base64');
        
      } catch (error) {
        if (attempt < maxRetries) {
          console.log(`❌ Fetch attempt ${attempt} failed: ${error.message}, retrying...`);
          await this.sleep(delayMs);
          continue;
        }
        
        console.error('Error fetching image after all retries:', error);
        throw new BadRequestException(`Failed to fetch image for analysis after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Detect MIME type more accurately
   */
  private detectMimeType(imageUrl: string, imageData: string): string {
    // Check URL patterns first
    if (imageUrl.includes('.png') || imageUrl.includes('f_png') || imageUrl.includes('format_png')) {
      return 'image/png';
    }
    
    if (imageUrl.includes('.webp') || imageUrl.includes('f_webp') || imageUrl.includes('format_webp')) {
      return 'image/webp';
    }
    
    if (imageUrl.includes('.gif') || imageUrl.includes('f_gif') || imageUrl.includes('format_gif')) {
      return 'image/gif';
    }

    // Check image data header (magic bytes) from base64
    try {
      const buffer = Buffer.from(imageData, 'base64');
      
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      if (buffer.length >= 8 && 
          buffer[0] === 0x89 && 
          buffer[1] === 0x50 && 
          buffer[2] === 0x4E && 
          buffer[3] === 0x47) {
        return 'image/png';
      }
      
      // JPEG magic bytes: FF D8 FF
      if (buffer.length >= 3 && 
          buffer[0] === 0xFF && 
          buffer[1] === 0xD8 && 
          buffer[2] === 0xFF) {
        return 'image/jpeg';
      }
      
      // WebP magic bytes: RIFF....WEBP
      if (buffer.length >= 12 &&
          buffer[0] === 0x52 && 
          buffer[1] === 0x49 && 
          buffer[2] === 0x46 && 
          buffer[3] === 0x46 &&
          buffer[8] === 0x57 && 
          buffer[9] === 0x45 && 
          buffer[10] === 0x42 && 
          buffer[11] === 0x50) {
        return 'image/webp';
      }
      
    } catch (error) {
      console.warn('Failed to analyze image header for MIME type:', error.message);
    }

    // Default fallback - since background removal typically outputs PNG
    // but most other images are JPEG
    if (imageUrl.includes('background_removal')) {
      return 'image/png';
    }
    
    return 'image/jpeg';
  }
} 