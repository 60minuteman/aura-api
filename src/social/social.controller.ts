import { Controller, Post, Delete, Get, Param, Request, UseGuards, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Social')
@Controller('social')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  // FOLLOW/UNFOLLOW ENDPOINTS
  @Post('follow/:userId')
  @ApiOperation({
    summary: 'Follow a user',
    description: 'Follow another user to see their images in your feed',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user to follow' })
  @ApiResponse({
    status: 201,
    description: 'User followed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        following: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Already following this user',
  })
  async followUser(@Param('userId') userId: string, @Request() req) {
    return this.socialService.followUser(req.user.id, userId);
  }

  @Delete('unfollow/:userId')
  @ApiOperation({
    summary: 'Unfollow a user',
    description: 'Unfollow a user to stop seeing their images in your feed',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user to unfollow' })
  @ApiResponse({
    status: 200,
    description: 'User unfollowed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        following: { type: 'boolean' },
      },
    },
  })
  async unfollowUser(@Param('userId') userId: string, @Request() req) {
    return this.socialService.unfollowUser(req.user.id, userId);
  }

  // LIKE/SHARE ENDPOINTS
  @Post('like/:auraId')
  @ApiOperation({
    summary: 'Like an aura',
    description: 'Like an aura to show appreciation',
  })
  @ApiParam({ name: 'auraId', description: 'ID of the aura to like' })
  @ApiResponse({
    status: 201,
    description: 'Aura liked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        liked: { type: 'boolean' },
        totalLikes: { type: 'number' },
      },
    },
  })
  async likeAura(@Param('auraId') auraId: string, @Request() req) {
    return this.socialService.likeAura(req.user.id, auraId);
  }

  @Delete('unlike/:auraId')
  @ApiOperation({
    summary: 'Unlike an aura',
    description: 'Remove like from an aura',
  })
  @ApiParam({ name: 'auraId', description: 'ID of the aura to unlike' })
  @ApiResponse({
    status: 200,
    description: 'Aura unliked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        liked: { type: 'boolean' },
        totalLikes: { type: 'number' },
      },
    },
  })
  async unlikeAura(@Param('auraId') auraId: string, @Request() req) {
    return this.socialService.unlikeAura(req.user.id, auraId);
  }

  @Post('share/:auraId')
  @ApiOperation({
    summary: 'Share an aura',
    description: 'Increment share count for an aura',
  })
  @ApiParam({ name: 'auraId', description: 'ID of the aura to share' })
  @ApiResponse({
    status: 201,
    description: 'Aura shared successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        totalShares: { type: 'number' },
      },
    },
  })
  async shareAura(@Param('auraId') auraId: string, @Request() req) {
    return this.socialService.shareAura(req.user.id, auraId);
  }

  // USER SOCIAL INFO
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user social information',
    description: 'Get user profile with follow status, stats, and recent 6 images',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user to view' })
  @ApiResponse({
    status: 200,
    description: 'User social info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        profilePictureUrl: { type: 'string' },
        isFollowing: { type: 'boolean' },
        isFollowedBy: { type: 'boolean' },
        stats: {
          type: 'object',
          properties: {
            totalScans: { type: 'number' },
            followers: { type: 'number' },
            following: { type: 'number' },
          },
        },
        recentImages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              originalUrl: { type: 'string' },
              aura: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  mood: { type: 'string' },
                  confidence: { type: 'number' },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  likes: { type: 'number' },
                  shares: { type: 'number' },
                },
              },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getUserSocialInfo(@Param('userId') userId: string, @Request() req) {
    return this.socialService.getUserSocialInfo(req.user.id, userId);
  }

  // LEADERBOARD ENDPOINT
  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get confidence leaderboard',
    description: 'Get leaderboard ranked by total confidence ratings with top 10 users, current user ranking, and rankings of users you follow',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        topTen: {
          type: 'array',
          description: 'Top 10 users globally ranked by confidence',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  profilePictureUrl: { type: 'string' },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  totalScans: { type: 'number' },
                  totalConfidence: { type: 'number' },
                  averageConfidence: { type: 'number' },
                  followers: { type: 'number' },
                },
              },
            },
          },
        },
        currentUser: {
          type: 'object',
          properties: {
            rank: { type: 'number' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                profilePictureUrl: { type: 'string' },
              },
            },
            stats: {
              type: 'object',
              properties: {
                totalScans: { type: 'number' },
                totalConfidence: { type: 'number' },
                averageConfidence: { type: 'number' },
                followers: { type: 'number' },
              },
            },
          },
        },
        followingRankings: {
          type: 'array',
          description: 'Rankings of users you are following',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'number' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  profilePictureUrl: { type: 'string' },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  totalScans: { type: 'number' },
                  totalConfidence: { type: 'number' },
                  averageConfidence: { type: 'number' },
                  followers: { type: 'number' },
                },
              },
            },
          },
        },
        totalUsers: { type: 'number' },
      },
    },
  })
  async getLeaderboard(@Request() req) {
    return this.socialService.getLeaderboard(req.user.id);
  }
}

@ApiTags('Explore')
@Controller('explore')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExploreController {
  constructor(private readonly socialService: SocialService) {}

  // NEW EXPLORE ENDPOINTS
  @Get('images')
  @ApiOperation({
    summary: 'Get explore images',
    description: 'Main explore feed with all verified users images and optional category filtering',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'category', required: false, description: 'Category filter: trending, recent, or mood name' })
  @ApiResponse({
    status: 200,
    description: 'Explore images retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          originalUrl: { type: 'string' },
          aura: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              mood: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              profilePictureUrl: { type: 'string' },
            },
          },
          stats: {
            type: 'object',
            properties: {
              likes: { type: 'number' },
              shares: { type: 'number' },
            },
          },
          createdAt: { type: 'string' },
        },
      },
    },
  })
  async getExploreImages(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('category') category?: string,
  ) {
    return this.socialService.getExploreImages(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
      category,
    );
  }

  @Get('trending')
  @ApiOperation({
    summary: 'Get trending images',
    description: 'Images sorted by engagement within specified timeframe',
  })
  @ApiQuery({ name: 'timeframe', required: false, description: 'Timeframe: today, week, month (default: week)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20)' })
  @ApiResponse({
    status: 200,
    description: 'Trending images retrieved successfully',
  })
  async getTrendingImages(
    @Request() req,
    @Query('timeframe') timeframe: string = 'week',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.socialService.getTrendingImages(
      req.user.id,
      timeframe,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('following')
  @ApiOperation({
    summary: 'Get user feed',
    description: 'Images from followed users only',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiResponse({
    status: 200,
    description: 'Following feed retrieved successfully',
  })
  async getFollowingFeed(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.socialService.getFollowingFeed(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('images/:imageId')
  @ApiOperation({
    summary: 'Get image details',
    description: 'Get detailed information about a specific image',
  })
  @ApiParam({ name: 'imageId', description: 'ID of the image to view' })
  @ApiResponse({
    status: 200,
    description: 'Image details retrieved successfully',
  })
  async getImageDetails(@Param('imageId') imageId: string, @Request() req) {
    return this.socialService.getImageDetails(req.user.id, imageId);
  }
} 