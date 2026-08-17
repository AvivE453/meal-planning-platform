import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WEIGHT_LOGGED_EVENT,
  type WeightLoggedEvent,
} from '../../logs/events/weight-logged.event';
import { RedisService } from '../../redis/redis.service';
import { targetsCacheKey } from '../targets.service';

/**
 * Observer: NestJS's EventEmitter2 is the Subject, this listener is the
 * Observer. Decoupled from WeightLogsService entirely — it only knows the
 * event name and payload shape, not who emits it or why.
 */
@Injectable()
export class RecalculateTargetsListener {
  private readonly logger = new Logger(RecalculateTargetsListener.name);

  constructor(private readonly redis: RedisService) {}

  @OnEvent(WEIGHT_LOGGED_EVENT)
  async handleWeightLogged({ userId }: WeightLoggedEvent): Promise<void> {
    await this.redis.del(targetsCacheKey(userId));
    this.logger.debug(`Invalidated cached targets for user ${userId}`);
  }
}
