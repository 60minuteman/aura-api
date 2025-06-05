import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  // FOLLOW/UNFOLLOW METHODS
  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Check if user exists
    const userToFollow = await this.prisma.user.findUnique({
      where: { id: followingId },
    });

    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      throw new ConflictException('Already following this user');
    }

    // Create follow relationship
    await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    return {
      message: 'User followed successfully',
      following: true,
    };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!existingFollow) {
      throw new NotFoundException('You are not following this user');
    }

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return {
      message: 'User unfollowed successfully',
      following: false,
    };
  }

  // LIKE/SHARE METHODS
  async likeAura(userId: string, auraId: string) {
    // Check if aura exists
    const aura = await this.prisma.aura.findUnique({
      where: { id: auraId },
    });

    if (!aura) {
      throw new NotFoundException('Aura not found');
    }

    // Check if already liked (we'll need to create a likes table)
    // For now, we'll just increment the likes count
    const updatedAura = await this.prisma.aura.update({
      where: { id: auraId },
      data: {
        likes: {
          increment: 1,
        },
      },
    });

    return {
      message: 'Aura liked successfully',
      liked: true,
      totalLikes: updatedAura.likes,
    };
  }

  async unlikeAura(userId: string, auraId: string) {
    // Check if aura exists
    const aura = await this.prisma.aura.findUnique({
      where: { id: auraId },
    });

    if (!aura) {
      throw new NotFoundException('Aura not found');
    }

    // Decrement likes (ensure it doesn't go below 0)
    const updatedAura = await this.prisma.aura.update({
      where: { id: auraId },
      data: {
        likes: {
          decrement: aura.likes > 0 ? 1 : 0,
        },
      },
    });

    return {
      message: 'Aura unliked successfully',
      liked: false,
      totalLikes: updatedAura.likes,
    };
  }

  async shareAura(userId: string, auraId: string) {
    // Check if aura exists
    const aura = await this.prisma.aura.findUnique({
      where: { id: auraId },
    });

    if (!aura) {
      throw new NotFoundException('Aura not found');
    }

    // Increment share count
    const updatedAura = await this.prisma.aura.update({
      where: { id: auraId },
      data: {
        shares: {
          increment: 1,
        },
      },
    });

    return {
      message: 'Aura shared successfully',
      totalShares: updatedAura.shares,
    };
  }

  // NEW EXPLORE METHODS
  async getExploreImages(userId: string, page: number = 1, limit: number = 20, category?: string) {
    const skip = (page - 1) * limit;
    
    // Build where clause based on category
    let whereClause: any = {
      // Public feed: all users' images (can add verified filter later)
      userId: {
        not: userId, // Exclude own images
      },
    };

    // Apply category filters
    if (category) {
      if (category === 'trending') {
        // For trending, we'll order by engagement later
        whereClause.aura = {
          confidence: {
            gte: 0.7, // High quality auras
          },
        };
      } else if (category === 'recent') {
        // Recent filter is handled by ordering
      } else {
        // Assume it's a mood filter
        whereClause.aura = {
          mood: {
            equals: category,
            mode: 'insensitive',
          },
        };
      }
    }

    // Determine ordering
    let orderBy: any = [{ createdAt: 'desc' }];
    if (category === 'trending') {
      orderBy = [
        { aura: { likes: 'desc' } },
        { aura: { shares: 'desc' } },
        { createdAt: 'desc' },
      ];
    }

    const images = await this.prisma.image.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            profilePictureUrl: true,
          },
        },
        aura: {
          select: {
            title: true,
            mood: true,
            confidence: true,
            likes: true,
            shares: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // Transform to match requested structure
    return images.map(image => ({
      id: image.id,
      originalUrl: image.originalUrl,
      aura: {
        title: image.aura?.title,
        mood: image.aura?.mood,
        confidence: image.aura?.confidence,
      },
      user: {
        id: image.user.id,
        firstName: image.user.firstName,
        profilePictureUrl: image.user.profilePictureUrl,
      },
      stats: {
        likes: image.aura?.likes || 0,
        shares: image.aura?.shares || 0,
      },
      createdAt: image.createdAt,
    }));
  }

  async getTrendingImages(userId: string, timeframe: string = 'week', page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    // Calculate date filter based on timeframe
    const now = new Date();
    let dateFilter: Date;
    
    switch (timeframe) {
      case 'today':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'week':
      default:
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const images = await this.prisma.image.findMany({
      where: {
        createdAt: {
          gte: dateFilter,
        },
        userId: {
          not: userId, // Exclude own images
        },
        aura: {
          confidence: {
            gte: 0.7, // High quality for trending
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            profilePictureUrl: true,
          },
        },
        aura: {
          select: {
            title: true,
            mood: true,
            confidence: true,
            likes: true,
            shares: true,
          },
        },
      },
      orderBy: [
        { aura: { likes: 'desc' } },
        { aura: { shares: 'desc' } },
        { aura: { confidence: 'desc' } },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    });

    // Transform to match requested structure
    return images.map(image => ({
      id: image.id,
      originalUrl: image.originalUrl,
      aura: {
        title: image.aura?.title,
        mood: image.aura?.mood,
        confidence: image.aura?.confidence,
      },
      user: {
        id: image.user.id,
        firstName: image.user.firstName,
        profilePictureUrl: image.user.profilePictureUrl,
      },
      stats: {
        likes: image.aura?.likes || 0,
        shares: image.aura?.shares || 0,
      },
      createdAt: image.createdAt,
    }));
  }

  async getFollowingFeed(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Get user's following list
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    if (followingIds.length === 0) {
      return []; // No following, return empty array
    }

    const images = await this.prisma.image.findMany({
      where: {
        userId: {
          in: followingIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            profilePictureUrl: true,
          },
        },
        aura: {
          select: {
            title: true,
            mood: true,
            confidence: true,
            likes: true,
            shares: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Transform to match requested structure
    return images.map(image => ({
      id: image.id,
      originalUrl: image.originalUrl,
      aura: {
        title: image.aura?.title,
        mood: image.aura?.mood,
        confidence: image.aura?.confidence,
      },
      user: {
        id: image.user.id,
        firstName: image.user.firstName,
        profilePictureUrl: image.user.profilePictureUrl,
      },
      stats: {
        likes: image.aura?.likes || 0,
        shares: image.aura?.shares || 0,
      },
      createdAt: image.createdAt,
    }));
  }

  async getImageDetails(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
          },
        },
        aura: {
          select: {
            id: true,
            title: true,
            description: true,
            mood: true,
            keywords: true,
            confidence: true,
            likes: true,
            shares: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return {
      id: image.id,
      originalUrl: image.originalUrl,
      fileName: image.fileName,
      fileSize: image.fileSize,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      user: image.user,
      aura: {
        ...image.aura,
        isLikedByUser: false, // TODO: Implement proper like tracking
      },
    };
  }

  // USER SOCIAL INFO
  async getUserSocialInfo(currentUserId: string, targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check follow relationships, get stats, and get recent images
    const [isFollowing, isFollowedBy, stats, recentImages] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: targetUserId,
          },
        },
      }),
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: targetUserId,
            followingId: currentUserId,
          },
        },
      }),
      this.getUserStats(targetUserId),
      this.prisma.image.findMany({
        where: { userId: targetUserId },
        include: {
          aura: {
            select: {
              title: true,
              mood: true,
              confidence: true,
              likes: true,
              shares: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    // Transform recent images to match explore format
    const formattedRecentImages = recentImages.map(image => ({
      id: image.id,
      originalUrl: image.originalUrl,
      aura: {
        title: image.aura?.title,
        mood: image.aura?.mood,
        confidence: image.aura?.confidence,
      },
      stats: {
        likes: image.aura?.likes || 0,
        shares: image.aura?.shares || 0,
      },
      createdAt: image.createdAt,
    }));

    return {
      ...user,
      isFollowing: !!isFollowing,
      isFollowedBy: !!isFollowedBy,
      stats: {
        totalScans: stats.totalScans,
        followers: stats.followers,
        following: stats.following,
      },
      recentImages: formattedRecentImages,
    };
  }

  private async getUserStats(userId: string) {
    const [totalScans, followers, following] = await Promise.all([
      this.prisma.image.count({ where: { userId } }),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      totalScans,
      followers,
      following,
    };
  }

  // LEADERBOARD METHOD
  async getLeaderboard(currentUserId: string) {
    // Get all users with their confidence stats
    const usersWithStats = await this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
        images: {
          include: {
            aura: {
              select: {
                confidence: true,
              },
            },
          },
        },
        _count: {
          select: {
            followers: true, // followers count (fixed field name)
          },
        },
      },
    });

    // Calculate stats and rank users
    const rankedUsers = usersWithStats
      .map(user => {
        const totalScans = user.images.length;
        const totalConfidence = user.images.reduce((sum, image) => {
          return sum + (image.aura?.confidence || 0);
        }, 0);
        const averageConfidence = totalScans > 0 ? totalConfidence / totalScans : 0;
        const followers = user._count.followers;

        return {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          },
          stats: {
            totalScans,
            totalConfidence: Math.round(totalConfidence * 100) / 100, // Round to 2 decimal places
            averageConfidence: Math.round(averageConfidence * 100) / 100,
            followers,
          },
        };
      })
      .filter(user => user.stats.totalScans > 0) // Only include users with at least 1 scan
      .sort((a, b) => {
        // Primary sort: Total confidence (descending)
        if (b.stats.totalConfidence !== a.stats.totalConfidence) {
          return b.stats.totalConfidence - a.stats.totalConfidence;
        }
        // Secondary sort: Average confidence (descending)
        if (b.stats.averageConfidence !== a.stats.averageConfidence) {
          return b.stats.averageConfidence - a.stats.averageConfidence;
        }
        // Tertiary sort: Total scans (descending)
        return b.stats.totalScans - a.stats.totalScans;
      })
      .map((user, index) => ({
        rank: index + 1,
        ...user,
      }));

    // Get top 10 users (changed from top 3)
    const topTen = rankedUsers.slice(0, 10);

    // Find current user's position
    const currentUserRanking = rankedUsers.find(user => user.user.id === currentUserId);

    // If current user has no scans, create a default entry
    const currentUser = currentUserRanking || {
      rank: rankedUsers.length + 1,
      user: await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePictureUrl: true,
        },
      }),
      stats: {
        totalScans: 0,
        totalConfidence: 0,
        averageConfidence: 0,
        followers: await this.prisma.follow.count({ where: { followingId: currentUserId } }),
      },
    };

    // NEW: Get users that current user is following and their rankings
    const followingList = await this.prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });

    const followingIds = followingList.map(f => f.followingId);
    
    // Filter ranked users to show only those the current user is following
    const followingRankings = rankedUsers
      .filter(user => followingIds.includes(user.user.id))
      .sort((a, b) => a.rank - b.rank); // Sort by rank (ascending)

    return {
      topTen, // Changed from topThree to topTen
      currentUser,
      followingRankings, // NEW: Rankings of users you're following
      totalUsers: rankedUsers.length,
    };
  }
} 