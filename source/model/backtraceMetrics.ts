import { BacktraceClientOptions } from '..';
import { SEC_TO_MILLIS } from '../consts';
import { APP_NAME, VERSION } from '../consts/application';
import { currentTimestamp, getEndpointParams, post, uuid } from '../utils';

/**
 * Handles Backtrace Metrics.
 */
export class BacktraceMetrics {
  private readonly universe: string;
  private readonly token: string;
  private readonly hostname: string;

  private readonly persistenceInterval: number = 1800000; // Thirty minutes in milliseconds.
  private readonly heartbeatInterval: number = 60000; // One minutes in milliseconds.

  private readonly timestamp = currentTimestamp();
  private readonly applicationName = APP_NAME;
  private readonly applicationVersion = VERSION;

  private summedEndpoint: string;
  private uniqueEndpoint: string;

  private sessionId: string | undefined;
  private sessionStart: number | undefined;
  private lastActive: number | undefined;

  constructor(
    configuration: BacktraceClientOptions,
    private readonly attributeProvider: () => object,
  ) {
    if (!configuration.endpoint) {
      throw new Error(`Backtrace: missing 'endpoint' option.`);
    }
    const endpointParameters = getEndpointParams(
      configuration.endpoint,
      configuration.token,
    );
    if (!endpointParameters) {
      throw new Error(
        `Invalid Backtrace submission parameters. Cannot create a submission URL to metrics support`,
      );
    }
    const { universe, token } = endpointParameters;

    if (!universe) {
      throw new Error(
        `Backtrace: 'universe' could not be parsed from the endpoint.`,
      );
    }

    if (!token) {
      throw new Error(
        `Backtrace: missing 'token' option or it could not be parsed from the endpoint.`,
      );
    }

    this.universe = universe;
    this.token = token;
    this.hostname =
      configuration.metricsSubmissionUrl ?? 'https://events.backtrace.io';

    this.summedEndpoint = `${this.hostname}/api/summed-events/submit?universe=${this.universe}&token=${this.token}`;
    this.uniqueEndpoint = `${this.hostname}/api/unique-events/submit?universe=${this.universe}&token=${this.token}`;

    this.persistSession(); // Create/persist session on construction.

    // Persist session every heartbeat interval.
    const intervalId: ReturnType<typeof setInterval> | undefined = setInterval(
      () => this.persistSession(),
      this.heartbeatInterval,
    );
  }

  /**
   * Handle persisting of session. When called, will create or manage current session.
   * when appropriate.
   */
  private persistSession(): void {
    console.log("session persisted.")
    // If sessionId is not set, create new session. Send unique and app launch events.
    if (!this.sessionId) {
      this.createNewSession();
      this.sendUniqueEvent();
      // An "application launch" loosely / temporarily means first session creation.
      this.sendSummedEvent('Application Launches');

      // If sessionId is set and lastActive is over persistenceInterval, create new session and send unique event.
      // if lastActive is not defined, the page was just launched; use current timestamp as lastActive.
    } else if (
      (this.lastActive || this.timestamp) <
      this.timestamp - this.persistenceInterval / SEC_TO_MILLIS
    ) {
      this.createNewSession();
      this.sendUniqueEvent();
    }

    this.lastActive = this.timestamp;
  }

  /**
   * Send POST to unique-events API endpoint
   */
  public async sendUniqueEvent(): Promise<void> {
    const payload = {
      application: this.applicationName,
      appversion: this.applicationVersion,
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

    await post(this.uniqueEndpoint, payload);
  }

  /**
   * Send POST to summed-events API endpoint
   */
  public async sendSummedEvent(metricGroup: string): Promise<void> {
    const payload = {
      application: this.applicationName,
      appversion: this.applicationVersion,
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

    await post(this.summedEndpoint, payload);
  }

  private getEventAttributes(): { [index: string]: any } {
    const clientAttributes = this.attributeProvider() as {
      [index: string]: any;
    };
    const result: { [index: string]: string } = {};

    for (const attributeName in clientAttributes) {
      if (
        Object.prototype.hasOwnProperty.call(clientAttributes, attributeName)
      ) {
        const element = clientAttributes[attributeName];
        const elementType = typeof element;

        if (
          elementType === 'string' ||
          elementType === 'boolean' ||
          elementType === 'number'
        ) {
          const attributeValue = element.toString();
          if (attributeValue) {
            result[attributeName] = attributeValue;
          }
        }
      }
    }
    return result;
  }

  /**
   * Create new sessionId and set sessionId, lastActive, and sessionStart.
   */
  private createNewSession(): string {
    const newSessionId = uuid();
    this.sessionId = newSessionId;
    this.lastActive = this.timestamp;
    this.sessionStart = this.timestamp;
    return newSessionId;
  }
}