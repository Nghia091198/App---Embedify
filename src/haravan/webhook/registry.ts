import type { Request, Response } from 'express';
import { handleAppUninstalled } from './handlers/appUninstalled.js';
import { handleShopUpdate } from './handlers/shopUpdate.js';

export const WEBHOOK_TOPICS_ACTIVE = ['app/uninstalled', 'shop/update'];

export async function dispatchWebhook(topic: string, req: Request, _res: Response): Promise<void> {
  switch (topic) {
    case 'app/uninstalled':
      await handleAppUninstalled(req);
      return;
    case 'shop/update':
      await handleShopUpdate(req);
      return;
    default:
      return;
  }
}
