import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";
import { BookingModel } from "../models/booking.model";

export class BookingCreateFunction extends LambdaFunction {

    @statistic(true)
    public async handler(event: any, context: any, callback: any) {
        console.log('BookingCreateFunction.handler()');

        let asd = await BookingModel.put({ 'id': '2' });
        console.log(`BookingCreateFunction.handler() - asd: ${JSON.stringify(asd)}`);

        let dsa = await BookingModel.get({ id: '2' });
        console.log(`BookingCreateFunction.handler() - dsa: ${JSON.stringify(dsa)}`);

        callback(null, {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Hello World!',
            }),
        });

    }

}
