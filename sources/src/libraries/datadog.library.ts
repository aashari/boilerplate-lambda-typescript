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
        `service:${process.env.FUNCTION_SERVICE_NAME}`,
        `version:${process.env.SERVICE_VERSION}`,
        `function_name:${process.env.FUNCTION_NAME}`,
        `function_unique_code:${process.env.FUNCTION_UNIQUE_CODE}`
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

    public static queueMetric(metricName: string, metricValue: number = 1, type: string = "count", additionalTags: string[] = []) {

        // check whether DD_API_KEY and DD_APP_KEY are set
        // if not set please make sure in the main.tf add dd-api-key and dd-app-key in the parameter_store_list
        // and make sure change the value in the web console or api console to the value in parameter_store
        if (!process.env.DD_APP_KEY || !process.env.DD_APP_KEY || process.env.DD_APP_KEY == 'placeholder' || process.env.DD_APP_KEY == 'placeholder') {
            return;
        }

        // generate current metric tag
        let currentMetricTag = [...new Set([...this.datadogLibraryInstance.defaultDatadogTags, ...additionalTags])].sort();

        // add current metric to series
        this.datadogLibraryInstance.metricSeries.push({
            metric: `${process.env.FUNCTION_SERVICE_NAME}.${metricName}`,
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

    }

    private static async publishMetrics(currentSeries: DatadogAPIClient.Series[]) {
        if (currentSeries.length == 0) return false;
        return this.datadogLibraryInstance.datadogMetricsAPI.submitMetrics({
            body: { series: currentSeries }
        }).then((result: any) => {
            console.info(`[DatadogLibrary][publishMetrics] successfully published ${currentSeries.length} metrics`);
            return true;
        }).catch((error: any) => {
            console.error(`[DatadogLibrary][publishMetrics] failed to publish ${currentSeries.length} metrics with error: ${error}`, error);
            return false;
        });
    }

    public static queueEvent(eventName: string, eventText: string, additionalTags: string[] = []) {
        // check whether DD_API_KEY and DD_APP_KEY are set
        // if not set please make sure in the main.tf add dd-api-key and dd-app-key in the parameter_store_list
        // and make sure change the value in the web console or api console to the value in parameter_store
        if (!process.env.DD_APP_KEY || !process.env.DD_APP_KEY || process.env.DD_APP_KEY == 'placeholder' || process.env.DD_APP_KEY == 'placeholder') {
            return;
        }

        // generate current event tag
        let currentEventTag = [...new Set([...this.datadogLibraryInstance.defaultDatadogTags, ...additionalTags])].sort();

        // add current event to series
        this.datadogLibraryInstance.eventSeries.push({
            title: eventName,
            text: eventText,
            tags: currentEventTag.map((tag: string) => tag.toLowerCase())
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
    }

    private static async publishEvents(currentSeries: DatadogAPIClient.Event[]) {
        if (currentSeries.length == 0) return false;
        let createEventPromises = currentSeries.map((event: DatadogAPIClient.Event) => {
            return this.datadogLibraryInstance.datadogEventsAPI.createEvent({
                body: {
                    title: event.title ?? "",
                    text: event.text ?? "",
                    tags: event.tags ?? []
                }
            });
        });
        return Promise.all(createEventPromises).then((result: any) => {
            console.info(`[DatadogLibrary][publishEvents] successfully published ${currentSeries.length} events`);
            return true;
        }).catch((error: any) => {
            console.error(`[DatadogLibrary][publishEvents] failed to publish ${currentSeries.length} events with error: ${error}`, error);
            return false;
        });
    }

}
