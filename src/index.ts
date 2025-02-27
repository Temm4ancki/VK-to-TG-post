// /index.ts
import dotenv from 'dotenv';
import { VKClient } from './services/vk-client';
import { TelegramClient } from './services/telegram-client';
import { StorageService } from './services/storage-service';
import { PostProcessor } from './services/post-processor';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Initialize services
    const vkClient = new VKClient({
      accessToken: process.env.VK_ACCESS_TOKEN!,
      groupId: process.env.VK_GROUP_ID!,
      apiVersion: process.env.VK_API_VERSION || '5.131'
    });

    const telegramClient = new TelegramClient({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      channelId: process.env.TELEGRAM_CHANNEL_ID!
    });

    const storageService = new StorageService({
      filePath: process.env.STORAGE_FILE_PATH || './data/processed-posts.json'
    });

    const postProcessor = new PostProcessor({
      vkClient,
      telegramClient,
      storageService
    });

    // Start the bot
    logger.info('Starting VK to Telegram bot...');
    
    // Initial run
    await postProcessor.processNewPosts();
    
    // Set up interval for checking new posts
    const checkInterval = parseInt(process.env.CHECK_INTERVAL_MS || '300000', 10); // Default: 5 minutes
    setInterval(async () => {
      try {
        await postProcessor.processNewPosts();
      } catch (error) {
        logger.error('Error during scheduled post processing:', error);
      }
    }, checkInterval);
    
    logger.info(`Bot is running. Checking for new posts every ${checkInterval / 1000} seconds`);
  } catch (error) {
    logger.error('Failed to start the bot:', error);
    process.exit(1);
  }
}

main();