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

    // create function name component
    let functionNameComponent = context.functionName.split('-');

    // parse the naming based on function name component
    let functionServiceName = functionNameComponent.shift();
    let functionUniqueCode = functionNameComponent.pop();
    let functionName = functionNameComponent.join('-');

    // store the function naming component to environment variable
    process.env.FUNCTION_SERVICE_NAME = functionServiceName;
    process.env.FUNCTION_NAME = functionName;
    process.env.FUNCTION_UNIQUE_CODE = functionUniqueCode;

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
        console.info(`lambda function unique code: ${functionUniqueCode}`);
        console.info(`lambda function service name: ${functionServiceName}`);
        console.info(`lambda function duration: ${new Date().getTime() - start} ms`);
        console.info(`lambda function left time: ${context.getRemainingTimeInMillis()} ms`);
        console.info(`---------------------------------------------`);

        // un comment this line to send the metric to datadog
        // let datadogTags = [
        //     `function_name:${functionName}`,
        //     `function_unique_code:${functionUniqueCode}`,
        //     `function_service_name:${functionServiceName}`,
        //     `status:${errorResponse ? 'failure' : 'success'}`
        // ];
        // // stream the metric to datadog
        // DatadogLibrary.queueMetric(`lambda.execution-count`, 1, "count", datadogTags);
        // DatadogLibrary.queueMetric(`lambda.execution-duration`, new Date().getTime() - start, "gauge", datadogTags);

        if (!errorResponse) return;
        console.error(`lambda function error: ${errorResponse}`, errorResponse);
        // // un comment this line to send the metric to datadog
        // DatadogLibrary.queueEvent(`Lambda function error: ${functionName}`, [
        //     `Function Name: ${functionName}`,
        //     `Function Unique Code: ${functionUniqueCode}`,
        //     `Function Service Name: ${functionServiceName}`,
        //     `Error: ${errorResponse}`,
        //     `Error Details: ${JSON.stringify(errorResponse)}`
        // ].join(`\n`), datadogTags);
        throw errorResponse;

    });
}

export function handler(event: any, context: any, callback: any) {
    startLambda(event, context, callback).catch((error: any) => {
        console.error(error);
        return Promise.reject(error);
    });
}
