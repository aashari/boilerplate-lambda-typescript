import { inspect } from "util";
import { DatadogLibrary } from "../libraries/datadog.library";

/**
 * Statistic decorator to record the execution time of a function/method, additionally it can deliver the metrics to Datadog.
 * 
 * If Datadog delivery is enabled, then there will be 2 metrics + 1 event sent to Datadog:
 * 1. The metrics with metric name: <service_name>.statistic.method_execution_duration which is the execution time of the function/method
 * 2. The metrics with metric name: <service_name>.statistic.method_execution_count which is the number of times the function/method has been executed
 * 3. The event with event title: "Method execution failure: <class_name>.<method_name>"
 * 
 * All of the metrics and events will be sent to Datadog with the additional default tags:
 * 1. class_name:<function_name>
 * 2. method_name:<function_name>
 * 3. status:success|failure
 * 
 * If Datadog delivery is disabled, then the statistic decorator will only record the execution time of the function/method and log the execution time to the console.
 * @param isLogToDatadog enable streaming the statistic to datadog
 * @returns void
 */
export function statistic(isLogToDatadog: boolean = false) {
    // return the decorator function which receives the target function
    return function statistic(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // call the _statistic function with the target function, propertyKey, descriptor and isLogToDatadog
        return _statistic(target, propertyKey, descriptor, isLogToDatadog);
    }
}

function _statistic(target: any, propertyKey: string, descriptor: PropertyDescriptor, isLogToDatadog: boolean = false) {
    // get the original function and store it in a variable
    const originalMethod = descriptor.value;
    // override the original function with a new function
    descriptor.value = function (...args: any[]) {
        // get the start time of the function execution
        const start = new Date().getTime();
        // get the class name of the target function
        // if the target.constructor.name is equal to "Function", then it means the target is a function/static method
        const className = (target.constructor.name != 'Function' ? target.constructor.name : target.name);
        // generate default Datadog tags
        const datadogTags = [`class_name:${className}`, `method_name:${propertyKey}`]
        // run the original function and calculate the execution time
        return originalMethod.apply(this, args).then((response: any) => {
            // record the execution time
            const executionDuration = new Date().getTime() - start;
            // if Datadog delivery is not enabled, then log the execution time to the console
            if (!isLogToDatadog) {
                console.info(`statistic.method-execution-duration:${className}.${propertyKey} ${executionDuration}ms`);
                // return the original function response
                return response;
            }
            // if Datadog delivery is enabled, then send the execution time and count to Datadog
            DatadogLibrary.queueMetric(`statistic.method-execution-duration`, executionDuration, `gauge`, [...datadogTags, `status:success`]);
            DatadogLibrary.queueMetric(`statistic.method-execution-count`, 1, `count`, [...datadogTags, `status:success`]);
            // return the original function response
            return response;
        }).catch((error: any) => {

            // record the execution time
            const executionDuration = new Date().getTime() - start;

            // if Datadog delivery is not enabled, then log the execution time to the console
            if (!isLogToDatadog) {
                console.error(`statistic.method-execution-duration:${className}.${propertyKey} ${executionDuration}ms`);
                // throw the original function error
                throw error;
            }

            // if Datadog delivery is enabled, then send the execution time and count to Datadog
            DatadogLibrary.queueMetric(`statistic.method-execution-duration`, executionDuration, `gauge`, [...datadogTags, `status:failure`]);
            DatadogLibrary.queueMetric(`statistic.method-execution-count`, 1, `count`, [...datadogTags, `status:failure`]);

            // log the errror message to cloudwatch logs
            console.error(`Method ${className}.${propertyKey} execution error`, error);

            // stream the error to datadog event
            DatadogLibrary.queueEvent(`Method ${className}.${propertyKey} execution error`, [
                `Class name: ${className}`,
                `Method name: ${propertyKey}`,
                `Error: ${error}`,
                `Error Details: ${inspect(error)}`
            ].join(`\n`), "error", [...datadogTags, `status:failure`]);

            // throw the original function error
            throw error;

        });
    };
}
