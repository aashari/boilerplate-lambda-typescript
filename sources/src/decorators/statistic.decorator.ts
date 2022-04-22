import { DatadogLibrary } from "../libraries/datadog.library";

export function statistic(isLogToDatadog: boolean = false) {
    return function statistic(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const start = new Date().getTime();
            const className = (target.constructor.name != 'Function' ? target.constructor.name : target.name);
            return originalMethod.apply(this, args).then((response: any) => {
                console.info(`[${className}][${propertyKey}] execution duration: ${new Date().getTime() - start} ms`);
                if (isLogToDatadog) DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:success`,
                ]);
                return response;
            }).catch((error: any) => {
                console.error(`[${className}][${propertyKey}] execution duration: ${new Date().getTime() - start} ms`);
                if (isLogToDatadog) DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:failure`,
                ]);
                throw error;
            });
        };
    }
}
