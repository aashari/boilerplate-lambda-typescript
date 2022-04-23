import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";

export class BookingCreateFunction extends LambdaFunction {

    @statistic(true)
    public async handler(event: any, context: any, callback: any) {
        console.log('BookingCreateFunction.handler()');
        callback(null, {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Hello World!',
            }),
        });
    }

}
