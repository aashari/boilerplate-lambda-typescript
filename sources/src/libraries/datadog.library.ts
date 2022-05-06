import { v1 as DatadogAPIClient } from '@datadog/datadog-api-client';

export class DatadogLibrary {

    private datadogConfiguration: DatadogAPIClient.Configuration;
    private datadogMetricsAPI: DatadogAPIClient.MetricsApi;
    private datadogEventsAPI: DatadogAPIClient.EventsApi;

    private static datadogLibraryInstance: DatadogLibrary;

    private metricSeries: DatadogAPIClient.Series[] = [];
    private metricWaitingHandle: NodeJS.Timeout | undefined;

    private eventSeries: DatadogAPIClient.Event[] = [];
    private eventWaitingHandle: NodeJS.Timeout | undefined;

    private defaultDatadogTags = [
        `service:${process.env.SERVICE_NAME}`,
        `version:${process.env.SERVICE_VERSION}`,
        `function_name:${process.env.FUNCTION_NAME}`,
    ];

    constructor() { }

    public async initiateDatadogConfiguration() {
        this.datadogConfiguration = DatadogAPIClient.createConfiguration();
        this.datadogMetricsAPI = new DatadogAPIClient.MetricsApi(this.datadogConfiguration);
        this.datadogEventsAPI = new DatadogAPIClient.EventsApi(this.datadogConfiguration);
    }

    public static async instance(): Promise<DatadogLibrary> {
        if (!DatadogLibrary.datadogLibraryInstance) DatadogLibrary.datadogLibraryInstance = new DatadogLibrary();
        await DatadogLibrary.datadogLibraryInstance.initiateDatadogConfiguration();
        return DatadogLibrary.datadogLibraryInstance;
    }

    /**
     * Queue a metric to be published to Datadog
     * @param metricName The name of the metric
     * @param metricValue The value of the metric
     * @param type The type of the metric (gauge or count)
     * @param additionalTags Additional tags to be added to the metric
     * @returns boolean indicating whether the metric was queued successfully
     */
    public static queueMetric(metricName: string, metricValue: number = 1, type: string = "count", additionalTags: string[] = []) {

        // check whether DD_API_KEY and DD_APP_KEY are set
        // if not set please make sure in the main.tf add dd-api-key and dd-app-key in the parameter_store_list
        // and make sure change the value in the web console or api console to the value in parameter_store
        if (!process.env.DD_APP_KEY || !process.env.DD_APP_KEY || process.env.DD_APP_KEY == 'placeholder' || process.env.DD_APP_KEY == 'placeholder') {
            return false;
        }

        // generate current metric tag
        let currentMetricTag = [...new Set([...this.datadogLibraryInstance.defaultDatadogTags, ...additionalTags])].sort();

        // metricName replace non alphanumeric and non dot characters
        metricName = metricName.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();

        // add current metric to series
        this.datadogLibraryInstance.metricSeries.push({
            metric: `${process.env.SERVICE_NAME}.${metricName}`.toLowerCase(),
            points: [[Math.round((new Date().getTime() / 1000)), metricValue]],
            host: process.env?.AWS_LAMBDA_FUNCTION_NAME ?? "",
            type: type,
            tags: currentMetricTag.map((tag: string) => tag.toLowerCase())
        });

        // if there's existing waiting to publish, cancel it
        if (this.datadogLibraryInstance.metricWaitingHandle) {
            clearTimeout(this.datadogLibraryInstance.metricWaitingHandle);
        }

        // if there's no metrics queued for 300ms second, publish them
        this.datadogLibraryInstance.metricWaitingHandle = setTimeout(() => {
            let currentSeries = JSON.parse(JSON.stringify(this.datadogLibraryInstance.metricSeries)) as DatadogAPIClient.Series[];
            this.datadogLibraryInstance.metricSeries = [];
            this.publishMetrics(currentSeries);
        }, 300);

        return true;

    }

    /**
     * Publish queued metrics to Datadog
     * @param currentSeries The series to be published
     * @returns Promise<boolean> indicating whether the metrics were published successfully
     */
    private static async publishMetrics(currentSeries: DatadogAPIClient.Series[]) {
        if (currentSeries.length == 0) return false;
        return this.datadogLibraryInstance.datadogMetricsAPI.submitMetrics({
            body: { series: currentSeries }
        }).then((result: any) => {
            console.info(`[DatadogLibrary][publishMetrics] successfully published ${currentSeries.length} metrics`, result);
            return true;
        }).catch((error: any) => {
            console.error(`[DatadogLibrary][publishMetrics] failed to publish ${currentSeries.length} metrics with error: ${error}`, error);
            return false;
        });
    }

    /**
     * Queue an event to be published to Datadog
     * @param eventName The name of the event
     * @param eventText The content/text of the event
     * @param additionalTags Additional tags to be added to the event
     * @returns boolean indicating whether the event was queued successfully
     */
    public static queueEvent(eventName: string, eventText: string, eventType: DatadogAPIClient.EventAlertType = "info", additionalTags: string[] = []) {
        // check whether DD_API_KEY and DD_APP_KEY are set
        // if not set please make sure in the main.tf add dd-api-key and dd-app-key in the parameter_store_list
        // and make sure change the value in the web console or api console to the value in parameter_store
        if (!process.env.DD_APP_KEY || !process.env.DD_APP_KEY || process.env.DD_APP_KEY == 'placeholder' || process.env.DD_APP_KEY == 'placeholder') {
            return false;
        }

        // generate current event tag
        let currentEventTag = [...new Set([...this.datadogLibraryInstance.defaultDatadogTags, ...additionalTags])].sort();

        // add current event to series
        this.datadogLibraryInstance.eventSeries.push({
            title: eventName,
            text: eventText,
            tags: currentEventTag.map((tag: string) => tag.toLowerCase()),
            alertType: eventType,
        });

        // if there's existing waiting to publish, cancel it
        if (this.datadogLibraryInstance.eventWaitingHandle) {
            clearTimeout(this.datadogLibraryInstance.eventWaitingHandle);
        }

        // if there's no events queued for 300ms, publish them
        this.datadogLibraryInstance.eventWaitingHandle = setTimeout(() => {
            let currentSeries = JSON.parse(JSON.stringify(this.datadogLibraryInstance.eventSeries)) as DatadogAPIClient.Event[];
            this.datadogLibraryInstance.eventSeries = [];
            this.publishEvents(currentSeries);
        }, 300);

        return true;

    }

    /**
     * Publish queued events to Datadog
     * @param currentSeries The series to be published
     * @returns Promise<boolean> indicating whether the events were published successfully
     */
    private static async publishEvents(currentSeries: DatadogAPIClient.Event[]) {
        if (currentSeries.length == 0) return false;
        let createEventPromises = currentSeries.map((event: DatadogAPIClient.Event) => {
            return this.datadogLibraryInstance.datadogEventsAPI.createEvent({
                body: {
                    title: event.title ?? "",
                    text: event.text ?? "",
                    tags: event.tags ?? [],
                    alertType: event.alertType ?? "info",
                }
            });
        });
        return Promise.all(createEventPromises).then((result: any) => {
            console.info(`[DatadogLibrary][publishEvents] successfully published ${currentSeries.length} events`, result);
            return true;
        }).catch((error: any) => {
            console.error(`[DatadogLibrary][publishEvents] failed to publish ${currentSeries.length} events with error: ${error}`, error);
            return false;
        });
    }

}
