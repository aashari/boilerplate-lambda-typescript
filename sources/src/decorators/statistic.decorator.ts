import { DatadogLibrary } from "../libraries/datadog.library";

class Statistic {

    private static statistic: Statistic;
    private statisticMessageList: string[] = [];
    private statisticMessageWaitingHandler: NodeJS.Timeout | undefined;

    public static async instance(): Promise<Statistic> {
        if (!Statistic.statistic) Statistic.statistic = new Statistic();
        return Statistic.statistic;
    }

    public static async queueMessage(message: string) {

        if (!Statistic.statistic) {
            Statistic.statistic = await Statistic.instance();
        }

        // generate queue for messages
        if (!this.statistic.statisticMessageList) this.statistic.statisticMessageList = [];
        this.statistic.statisticMessageList.push(message);

        // if there's existing waiting to publish, cancel it
        if (this.statistic.statisticMessageWaitingHandler) {
            clearTimeout(this.statistic.statisticMessageWaitingHandler);
        }

        // if there's no message waiting to publish, publish immediately
        this.statistic.statisticMessageWaitingHandler = setTimeout(() => {
            let currentMessageList: string[] = JSON.parse(JSON.stringify(this.statistic.statisticMessageList));
            this.statistic.statisticMessageList = [];
            this.batchLogMessages(currentMessageList);
        }, 1000);

    }

    private static batchLogMessages(messageList: string[]) {
        messageList.forEach(message => {
            console.info(message);
        });
    }

}

export function statistic(isLogToDatadog: boolean = false) {
    return function statistic(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const start = new Date().getTime();
            const className = (target.constructor.name != 'Function' ? target.constructor.name : target.name);
            return originalMethod.apply(this, args).then((response: any) => {
                if (!isLogToDatadog) return response;
                DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:success`,
                ]);
                return response;
            }).catch((error: any) => {
                if (!isLogToDatadog) throw error;
                DatadogLibrary.queueMetric(`statistic.method-execution-duration`, new Date().getTime() - start, `gauge`, [
                    `class_name:${className}`,
                    `method_name:${propertyKey}`,
                    `status:failure`,
                ]);
                throw error;
            }).finally(() => {
                if (!isLogToDatadog) {
                    Statistic.queueMessage(`[Decorator][Statistic] ${className}.${propertyKey} executed in ${new Date().getTime() - start}ms`)
                }
            })
        };
    }
}
