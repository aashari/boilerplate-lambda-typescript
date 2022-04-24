import { DatadogLibrary } from "../libraries/datadog.library";

export function statistic(isLogToDatadog: boolean = false) {
    return function statistic(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const start = new Date().getTime();
            const className = (target.constructor.name != 'Function' ? target.constructor.name : target.name);
            return originalMethod.apply(this, args).then((response: any) => {
                if (isLogToDatadog) DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:success`,
                ]);
                return response;
            }).catch((error: any) => {
                if (isLogToDatadog) DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:failure`,
                ]);
                throw error;
            }).finally(() => {
                console.info(`[Decorator][statistic] ${className}.${propertyKey} executed in ${new Date().getTime() - start}ms`);
            })
        };
    }
}
