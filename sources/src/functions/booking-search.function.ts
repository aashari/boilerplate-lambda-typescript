import { LambdaFunction } from "..";
import { statistic } from "../decorators/statistic.decorator";
import { BookingModel } from "../models/booking.model";

export class BookingSearchFunction extends LambdaFunction {

    @statistic(true)
    public async handler(event: any, context: any, callback: any) {
        console.log('BookingSearchFunction.handler()');
        let myBooking = await BookingModel.get({
            id: '12345',
        })

        callback(null, {
            statusCode: 200,
            body: JSON.stringify(myBooking),
        });
    }

}
