// /services/storage-service.ts
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface StorageServiceConfig {
  filePath: string;
}

export class StorageService {
  private filePath: string;
  private processedPosts: Set<string>;

  constructor(config: StorageServiceConfig) {
    this.filePath = config.filePath;
    this.processedPosts = new Set();
    this.initStorage();
  }

  /**
   * Initializes the storage by creating the directory and loading processed posts
   */
  private initStorage(): void {
    try {
      // Create directory if it doesn't exist
      const directory = path.dirname(this.filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Create file if it doesn't exist
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([]));
      }

      // Load processed posts
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const posts = JSON.parse(data);
      posts.forEach((postId: string) => this.processedPosts.add(postId));
      
      logger.info(`Loaded ${this.processedPosts.size} processed posts from storage`);
    } catch (error) {
      logger.error('Error initializing storage:', error);
      throw error;
    }
  }

  /**
   * Checks if a post has been processed
   * @param postId ID of the post
   * @returns True if the post has been processed, false otherwise
   */
  isPostProcessed(postId: string): boolean {
    return this.processedPosts.has(postId);
  }

  /**
   * Marks a post as processed
   * @param postId ID of the post
   */
  markPostAsProcessed(postId: string): void {
    this.processedPosts.add(postId);
    this.saveProcessedPosts();
  }

  /**
   * Saves the processed posts to the storage file
   */
  private saveProcessedPosts(): void {
    try {
      fs.writeFileSync(
        this.filePath, 
        JSON.stringify(Array.from(this.processedPosts))
      );
    } catch (error) {
      logger.error('Error saving processed posts:', error);
      throw error;
    }
  }

  /**
   * Gets all processed post IDs
   * @returns Array of processed post IDs
   */
  getProcessedPosts(): string[] {
    return Array.from(this.processedPosts);
  }
}