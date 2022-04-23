import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";

export class FlightSearchFunction extends LambdaFunction {

    @statistic()
    public async handler(event: any, context: any, callback: any) {
        console.log('FlightSearchFunction.handler()');
        callback(null, {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Hello World!',
            }),
        });
    }

}
