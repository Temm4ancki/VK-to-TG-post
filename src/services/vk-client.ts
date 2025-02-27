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
      
      // Определяем параметры запроса в зави��имости от формата groupId
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