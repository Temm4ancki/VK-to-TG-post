// /services/telegram-client.ts
import axios from 'axios';
import { logger } from '../utils/logger';

export interface TelegramClientConfig {
  botToken: string;
  channelId: string;
}

export class TelegramClient {
  private botToken: string;
  private channelId: string;
  private apiBaseUrl: string;

  constructor(config: TelegramClientConfig) {
    this.botToken = config.botToken;
    this.channelId = config.channelId;
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Sends a text message to the Telegram channel
   * @param text Message text
   * @returns Message ID
   */
  async sendMessage(text: string): Promise<number> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/sendMessage`, {
        chat_id: this.channelId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending message to Telegram:', error);
      throw error;
    }
  }

  /**
   * Sends a photo to the Telegram channel
   * @param photoUrl URL of the photo
   * @param caption Optional caption for the photo
   * @returns Message ID
   */
  async sendPhoto(photoUrl: string, caption?: string): Promise<number> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/sendPhoto`, {
        chat_id: this.channelId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending photo to Telegram:', error);
      throw error;
    }
  }

  /**
   * Sends an animation (GIF) to the Telegram channel
   * @param gifUrl URL of the GIF
   * @param caption Optional caption for the GIF
   * @returns Message ID
   */
  async sendAnimation(gifUrl: string, caption?: string): Promise<number> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/sendAnimation`, {
        chat_id: this.channelId,
        animation: gifUrl,
        caption: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending animation to Telegram:', error);
      throw error;
    }
  }

  /**
   * Sends an audio file to the Telegram channel
   * @param audioUrl URL of the audio file
   * @param caption Optional caption for the audio
   * @param title Optional title for the audio
   * @param performer Optional performer name for the audio
   * @returns Message ID
   */
  async sendAudio(audioUrl: string, caption?: string, title?: string, performer?: string): Promise<number> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/sendAudio`, {
        chat_id: this.channelId,
        audio: audioUrl,
        caption: caption,
        title: title,
        performer: performer,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending audio to Telegram:', error);
      throw error;
    }
  }

  /**
   * Sends a document to the Telegram channel
   * @param documentUrl URL of the document
   * @param caption Optional caption for the document
   * @returns Message ID
   */
  async sendDocument(documentUrl: string, caption?: string): Promise<number> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/sendDocument`, {
        chat_id: this.channelId,
        document: documentUrl,
        caption: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      if (response.data.ok) {
        return response.data.result.message_id;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending document to Telegram:', error);
      throw error;
    }
  }

  /**
   * Sends a media group (album) to the Telegram channel
   * @param mediaUrls Array of media URLs
   * @param caption Optional caption for the media group
   * @returns Array of message IDs
   */
  async sendMediaGroup(mediaUrls: string[], caption?: string): Promise<number[]> {
    try {
      if (mediaUrls.length === 0) return [];

      // Telegram allows max 10 items in a media group
      const media = mediaUrls.slice(0, 10).map((url, index) => ({
        type: 'photo',
        media: url,
        caption: index === 0 ? caption : undefined,
        parse_mode: index === 0 ? 'HTML' : undefined
      }));

      const response = await axios.post(`${this.apiBaseUrl}/sendMediaGroup`, {
        chat_id: this.channelId,
        media: media
      });

      if (response.data.ok) {
        return response.data.result.map((msg: any) => msg.message_id);
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      logger.error('Error sending media group to Telegram:', error);
      throw error;
    }
  }

  /**
   * Downloads a file from a URL
   * @param url URL of the file
   * @returns Buffer containing the file data
   */
  async downloadFile(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data, 'binary');
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw error;
    }
  }
}