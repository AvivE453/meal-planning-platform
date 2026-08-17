import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NutritionApiClient } from './nutrition-api-client.interface';

const EDAMAM_PARSER_URL = 'https://api.edamam.com/api/food-database/v2/parser';
const EDAMAM_NUTRIENTS_URL =
  'https://api.edamam.com/api/food-database/v2/nutrients';

/** The real subject: talks to the live Edamam Food Database API. */
@Injectable()
export class EdamamApiClient implements NutritionApiClient {
  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<unknown> {
    const url = new URL(EDAMAM_PARSER_URL);
    url.searchParams.set(
      'app_id',
      this.config.getOrThrow<string>('EDAMAM_APP_ID'),
    );
    url.searchParams.set(
      'app_key',
      this.config.getOrThrow<string>('EDAMAM_APP_KEY'),
    );
    url.searchParams.set('ingr', query);

    const res = await fetch(url);
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Edamam API request failed with status ${res.status}`,
      );
    }
    return res.json();
  }

  async getNutrients(
    foodId: string,
    measureUri: string,
    quantity: number,
  ): Promise<unknown> {
    const url = new URL(EDAMAM_NUTRIENTS_URL);
    url.searchParams.set(
      'app_id',
      this.config.getOrThrow<string>('EDAMAM_APP_ID'),
    );
    url.searchParams.set(
      'app_key',
      this.config.getOrThrow<string>('EDAMAM_APP_KEY'),
    );

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: [{ foodId, measureURI: measureUri, quantity }],
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `Edamam API request failed with status ${res.status}`,
      );
    }
    return res.json();
  }
}
