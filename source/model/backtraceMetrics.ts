import { BacktraceClientOptions } from '..';
import { currentTimestamp, getEndpointParams, post, uuid } from '../utils';

/**
 * Handles Backtrace Metrics.
 */
export class BacktraceMetrics {
  private readonly universe: string;
  private readonly token: string;
  private readonly hostname: string;

  private summedEndpoint: string;
  private uniqueEndpoint: string;

  private sessionId: string = uuid();

  constructor(
    configuration: BacktraceClientOptions,
    private readonly attributeProvider: () => object,
    private readonly _logger: { error(...data: any[]): void } | undefined,
  ) {
    if (!configuration.endpoint) {
      throw new Error(`Backtrace: missing 'endpoint' option.`);
    }
    const endpointParameters = getEndpointParams(configuration.endpoint, configuration.token);
    if (!endpointParameters) {
      throw new Error(`Invalid Backtrace submission parameters. Cannot create a submission URL to metrics support`);
    }
    const { universe, token } = endpointParameters;

    if (!universe) {
      throw new Error(`Backtrace: 'universe' could not be parsed from the endpoint.`);
    }

    if (!token) {
      throw new Error(`Backtrace: missing 'token' option or it could not be parsed from the endpoint.`);
    }

    this.universe = universe;
    this.token = token;
    this.hostname = configuration.metricsSubmissionUrl ?? 'https://events.backtrace.io';

    this.summedEndpoint = `${this.hostname}/api/summed-events/submit?universe=${this.universe}&token=${this.token}`;
    this.uniqueEndpoint = `${this.hostname}/api/unique-events/submit?universe=${this.universe}&token=${this.token}`;

    this.handleSession();
  }

  /**
   * Handle persisting of session. When called, will create a new session.
   */
  private handleSession(): void {
    // If sessionId is not set, create new session. Send unique and app launch events.
    this.sendUniqueEvent();
    this.sendSummedEvent('Application Launches');
  }

  /**
   * Send POST to unique-events API endpoint
   */
  public async sendUniqueEvent(): Promise<void> {
    const attributes = this.getEventAttributes();
    const payload = {
      application: attributes.application,
      appversion: attributes['application.version'],
      metadata: {
        dropped_events: 0,
      },
      unique_events: [
        {
          timestamp: currentTimestamp(),
          unique: ['guid'],
          attributes: this.getEventAttributes(),
        },
      ],
    };

    try {
      await post(this.uniqueEndpoint, payload);
    } catch (e) {
      this._logger?.error(`Encountered error sending unique event: ${e?.message}`);
    }
  }

  /**
   * Send POST to summed-events API endpoint
   */
  public async sendSummedEvent(metricGroup: string): Promise<void> {
    const attributes = this.getEventAttributes();

    const payload = {
      application: attributes.application,
      appversion: attributes['application.version'],
      metadata: {
        dropped_events: 0,
      },
      summed_events: [
        {
          timestamp: currentTimestamp(),
          metric_group: metricGroup,
          attributes: this.getEventAttributes(),
        },
      ],
    };

    try {
      await post(this.summedEndpoint, payload);
    } catch (e) {
      this._logger?.error(`Encountered error sending summed event: ${e?.message}`);
    }
  }

  private getEventAttributes(): { [index: string]: any } {
    const clientAttributes = this.attributeProvider() as {
      [index: string]: any;
    };
    const result: { [index: string]: string } = {
      'application.session': this.sessionId,
    };

    for (const attributeName in clientAttributes) {
      if (Object.prototype.hasOwnProperty.call(clientAttributes, attributeName)) {
        const element = clientAttributes[attributeName];
        const elementType = typeof element;

        if (elementType === 'string' || elementType === 'boolean' || elementType === 'number') {
          const attributeValue = element.toString();
          if (attributeValue) {
            result[attributeName] = attributeValue;
          }
        }
      }
    }
    return result;
  }
}
