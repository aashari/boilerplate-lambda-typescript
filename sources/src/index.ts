import { inspect } from "util";
import { populateEnvironmentVariables } from "./helpers/parameter-store.helper";
import { DynamoDBLibrary } from "./libraries/dynamodb.library";

export interface LambdaFunctionInterface {
    handler: (event: any, context: any, callback: any) => Promise<any>;
}

export class LambdaFunction implements LambdaFunctionInterface {
    public handler(event: any, context: any, callback: any) {
        console.log('LambdaFunction.handler()');
        return Promise.resolve(event);
    }
}

async function startLambda(event: any, context: any, callback: any) {

    // store the timestamp to calculate the duration
    const start = new Date().getTime();

    // parse the naming based on function name component
    let functionServiceName = process.env.SERVICE_NAME ?? `-`;
    let functionName = process.env.FUNCTION_NAME ?? `-`;

    // --------------------------------------------------
    // load the helpers here
    // --------------------------------------------------
    await populateEnvironmentVariables();

    // --------------------------------------------------
    // load the library instances here
    // --------------------------------------------------
    await DynamoDBLibrary.instance();
    // await DatadogLibrary.instance(); <-- un comment this line to enable datadog library

    // generate class name based on function name
    let className = functionName.split(`-`).map((x: string) => x.charAt(0).toUpperCase() + x.slice(1)).join(``) + 'Function';

    // import the class based on function name and class name, and create an instance of the class
    let LambdaFunctionClass = require(`./functions/${functionName}.function`)[className];

    // create the object of the class
    let lambdaFunction = new LambdaFunctionClass();

    // errror response object
    let errorResponse: any | undefined;

    // call the handler function of the object
    return lambdaFunction.handler(event, context, callback).catch((error: any) => {
        // catching unhandled promise rejections
        errorResponse = error;
        return;
    }).finally(() => {

        console.info(`---------------------------------------------`);
        console.info(`lambda function name: ${functionName}`);
        console.info(`lambda function service name: ${functionServiceName}`);
        console.info(`lambda function duration: ${new Date().getTime() - start} ms`);
        console.info(`lambda function left time: ${context.getRemainingTimeInMillis()} ms`);
        console.info(`---------------------------------------------`);

        // un comment this line to send the metric to datadog
        // let datadogTags = [
        //     `name:${functionName}`,
        //     `status:${errorResponse ? 'failure' : 'success'}`
        // ];

        // // stream the metric to datadog
        // DatadogLibrary.queueMetric(`lambda.execution-count`, 1, "count", datadogTags);
        // DatadogLibrary.queueMetric(`lambda.execution-duration`, new Date().getTime() - start, "gauge", datadogTags);
        // DatadogLibrary.queueMetric(`lambda.execution-left-time`, context.getRemainingTimeInMillis(), "gauge", datadogTags);

        if (!errorResponse) return;

        // log the errror message to cloudwatch logs
        console.error(`Lambda ${functionName} execution error`, errorResponse);

        // un comment this line to send the metric to datadog
        // // stream the error to datadog event
        // DatadogLibrary.queueEvent(`Lambda ${functionName} execution error`, [
        //     `Function Name: ${functionName}`,
        //     `Error: ${errorResponse}`,
        //     `Error Details: ${inspect(errorResponse)}`
        // ].join(`\n`), `error`, datadogTags);

        // throw the original error
        callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                error: errorResponse.message
            })
        });

    });
}

export function handler(event: any, context: any, callback: any) {
    startLambda(event, context, callback).catch((error: any) => {
        console.error(`Lambda execution error`, error);
        return Promise.reject(error);
    });
}
