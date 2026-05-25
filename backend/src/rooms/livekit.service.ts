import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, type VideoGrant } from 'livekit-server-sdk';

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly apiKey: string | undefined;
  private readonly apiSecret: string | undefined;
  readonly wsUrl: string | undefined;
  readonly enabled: boolean;

  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY?.trim();
    this.apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    this.wsUrl = process.env.LIVEKIT_URL?.trim();
    this.enabled = !!(this.apiKey && this.apiSecret && this.wsUrl);

    if (!this.enabled) {
      this.logger.warn('LiveKit не настроен — групповые звонки >6 человек будут использовать Mesh');
    }
  }

  async generateToken(params: {
    roomName: string;
    userId: string;
    displayName: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
    ttlSeconds?: number;
  }): Promise<string> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LiveKit не настроен');
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.userId,
      name: params.displayName,
      ttl: params.ttlSeconds ?? 4 * 60 * 60,
    });

    const grant: VideoGrant = {
      roomJoin: true,
      room: params.roomName,
      canPublish: params.canPublish ?? true,
      canSubscribe: params.canSubscribe ?? true,
      canPublishData: true,
    };

    at.addGrant(grant);
    return at.toJwt();
  }
}
