import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WEIGHT_LOGGED_EVENT,
  type WeightLoggedEvent,
} from '../../logs/events/weight-logged.event';
import { RedisService } from '../../redis/redis.service';
import { targetsCacheKey } from '../targets.service';
import {
  PROFILE_UPDATED_EVENT,
  type ProfileUpdatedEvent,
} from './profile-updated.event';

/**
 * Observer: NestJS's EventEmitter2 is the Subject, this listener is the
 * Observer. Decoupled from WeightLogsService/ProfileService entirely — it
 * only knows the event names and payload shapes, not who emits them or why.
 * Both events carry the same { userId } shape and mean the same thing for
 * this listener: "targets may now be stale for this user."
 */
@Injectable()
export class RecalculateTargetsListener {
  private readonly logger = new Logger(RecalculateTargetsListener.name);

  constructor(private readonly redis: RedisService) {}

  @OnEvent(WEIGHT_LOGGED_EVENT)
  async handleWeightLogged({ userId }: WeightLoggedEvent): Promise<void> {
    await this.invalidate(userId);
  }

  @OnEvent(PROFILE_UPDATED_EVENT)
  async handleProfileUpdated({ userId }: ProfileUpdatedEvent): Promise<void> {
    await this.invalidate(userId);
  }

  private async invalidate(userId: string): Promise<void> {
    await this.redis.del(targetsCacheKey(userId));
    this.logger.debug(`Invalidated cached targets for user ${userId}`);
  }
}
