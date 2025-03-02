// /services/vk-client.ts

import axios from 'axios';
import { logger } from '../utils/logger';

export interface VKPost {
  id: number;
  date: number;
  text: string;
  attachments?: any[];
  owner_id: number;
  from_id?: number;
  is_pinned?: number;
}

export interface VKAudioTrack {
  id: number;
  owner_id: number;
  artist: string;
  title: string;
  url?: string;
  duration?: number;
  date?: number;
}

export interface VKClientConfig {
  accessToken: string;
  groupId: string;
  apiVersion: string;
}

export class VKClient {
  private accessToken: string;
  private groupId: string;
  private apiVersion: string;
  private baseUrl = 'https://api.vk.com/method';

  constructor(config: VKClientConfig) {
    this.accessToken = config.accessToken;
    this.groupId = config.groupId;
    this.apiVersion = config.apiVersion;
  }

  /**
   * Fetches posts from the VK community
   * @param count Number of posts to fetch
   * @param offset Offset for pagination
   * @returns Array of VK posts
   */
  async getPosts(count: number = 10, offset: number = 0): Promise<VKPost[]> {
    try {
      logger.info(`Fetching posts from VK group ID: ${this.groupId}`);

      // Определяем параметры запроса в зависимости от формата groupId
      const params: Record<string, any> = {
        count,
        offset,
        access_token: this.accessToken,
        v: this.apiVersion
      };

      // Проверяем, является ли groupId числовым или текстовым
      if (/^\d+$/.test(this.groupId)) {
        // Если groupId содержит только цифры, используем owner_id
        params.owner_id = `-${this.groupId}`; // Минус для сообществ
      } else {
        // Если groupId содержит буквы (домен), используем domain
        params.domain = this.groupId;
      }

      const response = await axios.get(`${this.baseUrl}/wall.get`, {
        params
      });

      if (response.data.error) {
        logger.error(`VK API Error: ${JSON.stringify(response.data.error)}`);
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }

      return response.data.response.items;
    } catch (error: any) {
      if (error.response) {
        logger.error(`VK API Error Response: ${JSON.stringify(error.response.data)}`);
      }
      logger.error('Error fetching posts from VK:', error);
      throw error;
    }
  }

  /**
   * Searches for an audio track by artist and title
   * @param artist Artist name
   * @param title Track title
   * @returns Audio track information or null if not found
   */
  async findAudioTrack(artist: string, title: string): Promise<VKAudioTrack | null> {
    try {
      logger.info(`Searching for audio track: ${artist} - ${title}`);
      
      // Create search query
      const query = `${artist} - ${title}`;
      
      const params = {
        q: query,
        count: 5, // Limit to 5 results
        access_token: this.accessToken,
        v: this.apiVersion
      };

      // Try audio.search method first
      try {
        const response = await axios.get(`${this.baseUrl}/audio.search`, {
          params
        });

        if (response.data.error) {
          logger.warn(`VK API Error in audio.search: ${JSON.stringify(response.data.error)}`);
          // Continue to fallback method
        } else if (response.data.response && response.data.response.items && response.data.response.items.length > 0) {
          // Find the best match
          const tracks = response.data.response.items;
          const bestMatch = this.findBestAudioMatch(tracks, artist, title);
          
          if (bestMatch) {
            return {
              id: bestMatch.id,
              owner_id: bestMatch.owner_id,
              artist: bestMatch.artist,
              title: bestMatch.title,
              url: bestMatch.url,
              duration: bestMatch.duration
            };
          }
        }
      } catch (error) {
        logger.warn(`Error using audio.search method:`, error);
        // Continue to fallback method
      }

      // Fallback to using the general search API
      const generalSearchParams = {
        q: query,
        count: 10,
        access_token: this.accessToken,
        v: this.apiVersion,
        type: 'audio'
      };

      const generalResponse = await axios.get(`${this.baseUrl}/search`, {
        params: generalSearchParams
      });

      if (generalResponse.data.error) {
        logger.error(`VK API Error in general search: ${JSON.stringify(generalResponse.data.error)}`);
        return null;
      }

      if (generalResponse.data.response && 
          generalResponse.data.response.items && 
          generalResponse.data.response.items.length > 0) {
        
        const tracks = generalResponse.data.response.items;
        const bestMatch = this.findBestAudioMatch(tracks, artist, title);
        
        if (bestMatch) {
          return {
            id: bestMatch.id,
            owner_id: bestMatch.owner_id,
            artist: bestMatch.artist,
            title: bestMatch.title,
            url: bestMatch.url,
            duration: bestMatch.duration
          };
        }
      }

      logger.info(`No matching audio track found for: ${artist} - ${title}`);
      return null;
    } catch (error) {
      logger.error(`Error searching for audio track "${artist} - ${title}":`, error);
      return null;
    }
  }

  /**
   * Finds the best matching audio track from a list of tracks
   * @param tracks List of audio tracks
   * @param targetArtist Artist to match
   * @param targetTitle Title to match
   * @returns Best matching track or null if no good match
   */
  private findBestAudioMatch(
    tracks: any[], 
    targetArtist: string, 
    targetTitle: string
  ): any | null {
    if (!tracks || tracks.length === 0) {
      return null;
    }

    // Normalize the target strings
    const normalizedTargetArtist = this.normalizeString(targetArtist);
    const normalizedTargetTitle = this.normalizeString(targetTitle);

    // Score each track based on similarity
    const scoredTracks = tracks.map(track => {
      const normalizedArtist = this.normalizeString(track.artist);
      const normalizedTitle = this.normalizeString(track.title);

      // Calculate similarity scores (0-1)
      const artistSimilarity = this.calculateStringSimilarity(normalizedTargetArtist, normalizedArtist);
      const titleSimilarity = this.calculateStringSimilarity(normalizedTargetTitle, normalizedTitle);

      // Weight artist and title similarity (artist slightly more important)
      const totalScore = (artistSimilarity * 0.6) + (titleSimilarity * 0.4);

      return {
        track,
        score: totalScore
      };
    });

    // Sort by score (highest first)
    scoredTracks.sort((a, b) => b.score - a.score);

    // Return the best match if it's good enough (threshold: 0.7)
    if (scoredTracks.length > 0 && scoredTracks[0].score >= 0.7) {
      return scoredTracks[0].track;
    }

    return null;
  }

  /**
   * Calculates similarity between two strings (0-1)
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score (0-1)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 && !str2) return 1; // Both empty = perfect match
    if (!str1 || !str2) return 0; // One empty = no match

    // Check for exact match
    if (str1 === str2) return 1;

    // Check if one contains the other
    if (str1.includes(str2) || str2.includes(str1)) {
      const longerLength = Math.max(str1.length, str2.length);
      const shorterLength = Math.min(str1.length, str2.length);
      return shorterLength / longerLength;
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    // Convert distance to similarity score (0-1)
    return 1 - (distance / maxLength);
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param str1 First string
   * @param str2 Second string
   * @returns Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Normalizes a string for comparison
   * @param str String to normalize
   * @returns Normalized string
   */
  private normalizeString(str: string): string {
    if (!str) return '';
    
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }

  /**
   * Gets photo attachments from a post
   * @param post VK post object
   * @returns Array of photo URLs
   */
  getPhotoAttachments(post: VKPost): string[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => attachment.type === 'photo')
      .map(attachment => {
        const photo = attachment.photo;
        // Get the largest size photo
        const sizes = photo.sizes.sort((a: any, b: any) =>
          (b.width * b.height) - (a.width * a.height)
        );
        return sizes[0].url;
      });
  }

  /**
   * Gets GIF attachments from a post
   * @param post VK post object
   * @returns Array of GIF URLs
   */
  getGifAttachments(post: VKPost): string[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => {
        // Проверяем на doc с типом gif
        return attachment.type === 'doc' &&
          attachment.doc &&
          (attachment.doc.ext === 'gif' ||
          (attachment.doc.type === 3) || // Тип 3 - GIF в VK API
          (attachment.doc.title && attachment.doc.title.toLowerCase().endsWith('.gif')));
      })
      .map(attachment => {
        return attachment.doc.url;
      });
  }

  /**
   * Gets audio attachments from a post
   * @param post VK post object
   * @returns Array of audio information
   */
  getAudioAttachments(post: VKPost): { url?: string, artist?: string, title?: string }[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => attachment.type === 'audio')
      .map(attachment => {
        const audio = attachment.audio;
        return {
          url: audio.url,
          artist: audio.artist,
          title: audio.title
        };
      });
  }

  /**
   * Gets video attachments from a post
   * @param post VK post object
   * @returns Array of video information
   */
  getVideoAttachments(post: VKPost): { owner_id: number, id: number, access_key?: string }[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => attachment.type === 'video')
      .map(attachment => {
        const video = attachment.video;
        return {
          owner_id: video.owner_id,
          id: video.id,
          access_key: video.access_key
        };
      });
  }

  /**
   * Gets link attachments from a post
   * @param post VK post object
   * @returns Array of link URLs
   */
  getLinkAttachments(post: VKPost): string[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => attachment.type === 'link')
      .map(attachment => attachment.link.url);
  }

  /**
   * Gets document attachments from a post (excluding GIFs which are handled separately)
   * @param post VK post object
   * @returns Array of document URLs
   */
  getDocumentAttachments(post: VKPost): { url: string, title: string, ext: string }[] {
    if (!post.attachments) return [];

    return post.attachments
      .filter(attachment => {
        // Включаем все документы, кроме GIF (они обрабатываются отдельно)
        return attachment.type === 'doc' &&
          attachment.doc &&
          !(attachment.doc.ext === 'gif' ||
          (attachment.doc.type === 3) ||
          (attachment.doc.title && attachment.doc.title.toLowerCase().endsWith('.gif')));
      })
      .map(attachment => {
        const doc = attachment.doc;
        return {
          url: doc.url,
          title: doc.title,
          ext: doc.ext
        };
      });
  }

  /**
   * Generates a link to the post
   * @param post VK post object
   * @returns URL to the post
   */
  getPostUrl(post: VKPost): string {
    // Для корректного формирования URL используем owner_id из поста
    return `https://vk.com/wall${post.owner_id}_${post.id}`;
  }
}