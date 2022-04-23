import { v1 as DatadogAPIClient } from '@datadog/datadog-api-client';

export class DatadogLibrary {

    private datadogConfiguration: DatadogAPIClient.Configuration;
    private datadogMetricsAPI: DatadogAPIClient.MetricsApi;

    private static datadogLibraryInstance: DatadogLibrary;

    private metricSeries: DatadogAPIClient.Series[] = [];
    private metricWaitingHandle: NodeJS.Timeout | undefined;
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

        // if there's no metrics queued for 1 second, publish them
        this.datadogLibraryInstance.metricWaitingHandle = setTimeout(() => {
            let currentSeries = JSON.parse(JSON.stringify(this.datadogLibraryInstance.metricSeries)) as DatadogAPIClient.Series[];
            this.datadogLibraryInstance.metricSeries = [];
            this.publishMetrics(currentSeries);
        }, 300);

    }

    private static async publishMetrics(currentSeries: DatadogAPIClient.Series[]) {
        console.info(`[DatadogLibrary] publishing ${currentSeries.length} metrics`);
        if (currentSeries.length == 0) return false;
        return this.datadogLibraryInstance.datadogMetricsAPI.submitMetrics({
            body: { series: currentSeries }
        }).then((result: any) => {
            console.info(`[DatadogLibrary] successfully published ${currentSeries.length} metrics`, JSON.stringify({ result, currentSeries }));
            return true;
        }).catch((error: any) => {
            console.error(`[DatadogLibrary] failed to publish metrics:`, error);
            return false;
        }).finally(() => {
            console.info(`[DatadogLibrary] finished publishing metrics`);
            return true;
        });
    }

}
