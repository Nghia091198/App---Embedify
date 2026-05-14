import type { Request, Response } from 'express';
import { handleAppUninstalled } from './handlers/appUninstalled.js';
import { handleShopUpdate } from './handlers/shopUpdate.js';
import { handleProductUpdated } from './handlers/productUpdated.js';
import { handleProductDeleted } from './handlers/productDeleted.js';

export const WEBHOOK_TOPICS_ACTIVE = [
  'app/uninstalled',
  'shop/update',
  'products/update',
  'products/deleted',
  // 'app_subscriptions/update', // TODO: bật khi có billing scope + subscribe topic
];

export async function dispatchWebhook(topic: string, req: Request, _res: Response): Promise<void> {
  switch (topic) {
    case 'app/uninstalled':
      await handleAppUninstalled(req);
      return;
    case 'shop/update':
      await handleShopUpdate(req);
      return;
    case 'products/update':
      await handleProductUpdated(req);
      return;
    case 'products/deleted':
      await handleProductDeleted(req);
      return;
    default:
      return;
  }
}
