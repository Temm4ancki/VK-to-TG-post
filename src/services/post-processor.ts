// /services/post-processor.ts

import { VKClient, VKPost } from './vk-client';
import { TelegramClient } from './telegram-client';
import { StorageService } from './storage-service';
import { logger } from '../utils/logger';

export interface PostProcessorConfig {
  vkClient: VKClient;
  telegramClient: TelegramClient;
  storageService: StorageService;
}

export class PostProcessor {
  private vkClient: VKClient;
  private telegramClient: TelegramClient;
  private storageService: StorageService;

  constructor(config: PostProcessorConfig) {
    this.vkClient = config.vkClient;
    this.telegramClient = config.telegramClient;
    this.storageService = config.storageService;
  }

  /**
   * Processes new posts from VK and forwards them to Telegram
   */
  async processNewPosts(): Promise<void> {
    try {
      logger.info('Checking for new posts...');

      // Get posts from VK
      const posts = await this.vkClient.getPosts(20, 0);

      if (!posts || posts.length === 0) {
        logger.info('No posts found');
        return;
      }

      logger.info(`Found ${posts.length} posts`);

      // Process posts in reverse order (oldest first)
      for (const post of [...posts].reverse()) {
        await this.processPost(post);
      }

      logger.info('Finished processing posts');
    } catch (error) {
      // Simplified error logging to avoid huge logs
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error';
      
      logger.error(`Error processing new posts: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Processes a single post
   * @param post VK post object
   */
  private async processPost(post: VKPost): Promise<void> {
    const postId = `${post.owner_id}_${post.id}`;

    // Skip if post has already been processed
    if (this.storageService.isPostProcessed(postId)) {
      logger.debug(`Post ${postId} already processed, skipping`);
      return;
    }

    try {
      logger.info(`Processing post ${postId}`);

      // Skip ads or pinned posts if needed
      if (post.is_pinned) {
        logger.info(`Skipping pinned post ${postId}`);
        this.storageService.markPostAsProcessed(postId);
        return;
      }

      // Format post text
      let text = post.text || '';

      // Add post URL
      const postUrl = this.vkClient.getPostUrl(post);
      text += `\n\n<a href="${postUrl}">Оригинальный пост</a>`;

      // Get attachments
      const photoUrls = this.vkClient.getPhotoAttachments(post);
      const gifUrls = this.vkClient.getGifAttachments(post);
      const audioAttachments = await this.processAudioAttachments(post);
      const linkUrls = this.vkClient.getLinkAttachments(post);
      const documentAttachments = this.vkClient.getDocumentAttachments(post);

      // Add links to text
      if (linkUrls.length > 0) {
        text += '\n\nСсылки:';
        linkUrls.forEach(url => {
          text += `\n<a href="${url}">${url}</a>`;
        });
      }

      // Отправляем контент в Telegram
      await this.sendContentToTelegram(
        text,
        photoUrls,
        gifUrls,
        audioAttachments,
        documentAttachments
      );

      // Mark post as processed
      this.storageService.markPostAsProcessed(postId);
      logger.info(`Successfully processed post ${postId}`);
    } catch (error) {
      // Simplified error logging
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error';
      
      logger.error(`Error processing post ${postId}: ${errorMessage}`);
      // Don't throw here to continue processing other posts
    }
  }

  /**
   * Process audio attachments, searching for missing URLs
   * @param post VK post object
   * @returns Processed audio attachments
   */
  private async processAudioAttachments(post: VKPost): Promise<{ url?: string, artist?: string, title?: string }[]> {
    try {
      // Get audio attachments from post
      const audioAttachments = this.vkClient.getAudioAttachments(post);
      
      // Process each audio attachment
      const processedAttachments = [];
      
      for (const audio of audioAttachments) {
        // If the audio already has a URL, use it
        if (audio.url) {
          processedAttachments.push(audio);
          continue;
        }
        
        // If no URL but we have artist and title, try to find it
        if (audio.artist && audio.title) {
          try {
            logger.info(`Searching for audio: ${audio.artist} - ${audio.title}`);
            const foundTrack = await this.vkClient.findAudioTrack(audio.artist, audio.title);
            
            if (foundTrack && foundTrack.url) {
              logger.info(`Found audio track: ${audio.artist} - ${audio.title}`);
              processedAttachments.push({
                url: foundTrack.url,
                artist: audio.artist,
                title: audio.title
              });
            } else {
              // If we couldn't find the track, still include it without URL
              // It will be added as text in the message
              logger.info(`Could not find URL for audio: ${audio.artist} - ${audio.title}`);
              processedAttachments.push(audio);
            }
          } catch (error) {
            logger.warn(`Error searching for audio track: ${audio.artist} - ${audio.title}`);
            processedAttachments.push(audio);
          }
        } else {
          // If we don't have enough info, just pass it through
          processedAttachments.push(audio);
        }
      }
      
      return processedAttachments;
    } catch (error) {
      // If there's an error in processing, return the original attachments
      logger.error('Error processing audio attachments');
      return this.vkClient.getAudioAttachments(post);
    }
  }

  /**
   * Sends content to Telegram in the appropriate order
   */
  private async sendContentToTelegram(
    text: string,
    photoUrls: string[],
    gifUrls: string[],
    audioAttachments: { url?: string, artist?: string, title?: string }[],
    documentAttachments: { url: string, title: string, ext: string }[]
  ): Promise<void> {
    try {
      // Add audio tracks without URLs to the text
      const audioTracksWithoutUrl = audioAttachments.filter(audio => !audio.url && audio.artist && audio.title);
      if (audioTracksWithoutUrl.length > 0) {
        text += '\n\nАудио:';
        audioTracksWithoutUrl.forEach(audio => {
          text += `\n🎵 ${audio.artist} - ${audio.title}`;
        });
      }

      // Если есть только текст, отправляем его отдельно
      if (
        photoUrls.length === 0 &&
        gifUrls.length === 0 &&
        audioAttachments.filter(a => a.url).length === 0 &&
        documentAttachments.length === 0
      ) {
        await this.telegramClient.sendMessage(text);
        return;
      }

      // Если есть фотографии, отправляем их с текстом
      if (photoUrls.length > 0) {
        if (photoUrls.length === 1) {
          // Одна фотография
          await this.telegramClient.sendPhoto(photoUrls[0], text);
        } else {
          // Альбом фотографий
          await this.telegramClient.sendMediaGroup(photoUrls, text);
        }
        // Очищаем текст для последующих вложений
        text = '';
      }

      // Отправляем GIF-аним��ции
      for (const gifUrl of gifUrls) {
        await this.telegramClient.sendAnimation(gifUrl, text);
        // Очищаем текст после первой отправки
        text = '';
      }

      // Отправляем аудиофайлы (только те, у которых есть URL)
      for (const audio of audioAttachments.filter(a => a.url)) {
        if (audio.url) {
          await this.telegramClient.sendAudio(
            audio.url,
            text,
            audio.title,
            audio.artist
          );
          // Очищаем текст после первой отправки
          text = '';
        }
      }

      // Отправляем документы
      for (const doc of documentAttachments) {
        await this.telegramClient.sendDocument(doc.url, text || `Документ: ${doc.title}`);
        // Очищаем текст после первой отправки
        text = '';
      }
    } catch (error) {
      // Simplified error logging
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error';
      
      logger.error(`Error sending content to Telegram: ${errorMessage}`);
      
      // Try to send at least the text if media sending fails
      if (text) {
        try {
          await this.telegramClient.sendMessage(`${text}\n\n[Ошибка при отправке медиа: ${errorMessage}]`);
        } catch (secondError) {
          logger.error('Failed to send fallback text message');
        }
      }
    }
  }
}